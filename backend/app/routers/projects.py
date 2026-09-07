from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..director import (
    DirectorError,
    DirectorUnavailableError,
    generate_game_bible,
    slugify,
)
from .. import playtest
from ..models import GameBibleRow, Job, Project
from ..playtest import PlaytestError, PlaytestUnavailableError
from ..schemas import (
    CreateProjectRequest,
    CreateProjectResponse,
    GameBibleOut,
    JobOut,
    PlaytestReportOut,
    ProjectDetailOut,
    ProjectOut,
)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session)) -> list[Project]:
    return list(session.scalars(select(Project).order_by(Project.created_at)))


@router.get("/{slug}", response_model=ProjectDetailOut)
def get_project(slug: str, session: Session = Depends(get_session)) -> Project:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail=f"project '{slug}' not found")
    return project


@router.get("/{slug}/gamebible", response_model=GameBibleOut)
def get_game_bible(slug: str, session: Session = Depends(get_session)) -> GameBibleOut:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")
    return GameBibleOut(
        project_slug=project.slug,
        schema_version=project.game_bible.schema_version,
        data=project.game_bible.data,
    )


@router.get("/{slug}/jobs", response_model=list[JobOut])
def list_jobs(slug: str, session: Session = Depends(get_session)) -> list[Job]:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail=f"project '{slug}' not found")
    return list(
        session.scalars(select(Job).where(Job.project_id == project.id).order_by(Job.created_at))
    )


@router.get("/{slug}/playtest", response_model=PlaytestReportOut)
def get_playtest(slug: str, session: Session = Depends(get_session)) -> PlaytestReportOut:
    """Run the deterministic Playtester (M3) against the project's GameBible.

    Returns an evidence-backed verdict per quality gate (builds, boots,
    controls, win reachable, lose reachable, restart). 503 when the playtester
    can't run in this environment; 500 when it ran but produced no report.
    """
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    try:
        report = playtest.playtest_bible(project.game_bible.data)
    except PlaytestUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PlaytestError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return PlaytestReportOut.model_validate(report)


def _unique_slug(session: Session, base: str) -> str:
    """Guarantee a free slug by suffixing -2, -3, … if the base is taken."""
    slug = base
    n = 2
    while session.scalar(select(Project).where(Project.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
    return slug


@router.post("", response_model=CreateProjectResponse, status_code=201)
async def create_project(
    body: CreateProjectRequest, session: Session = Depends(get_session)
) -> CreateProjectResponse:
    """Run the Game Director: prompt -> validated Game Bible -> new project.

    The generated document is schema-validated before it is persisted, and the
    run is recorded as a real Job so the Studio shows honest provenance.
    """
    try:
        result = await generate_game_bible(body.prompt)
    except DirectorUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DirectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    doc = result.doc
    game = doc["game"]
    slug = _unique_slug(session, slugify(game["slug"]))

    project = Project(
        slug=slug,
        title=game["title"],
        summary=game["one_liner"],
        genre=game["genre"],
        status="draft",
        provenance="ai_generated" if result.mode == "llm" else "offline_draft",
    )
    project.game_bible = GameBibleRow(schema_version=doc["schemaVersion"], data=doc)
    project.jobs.append(
        Job(
            type="director_draft",
            status="succeeded",
            payload={"prompt": body.prompt, "mode": result.mode},
            result={"notes": result.notes, "slug": slug},
            finished_at=datetime.now(timezone.utc),
        )
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    return CreateProjectResponse(
        project=ProjectOut.model_validate(project),
        game_bible=doc,
        mode=result.mode,
        notes=result.notes,
    )
