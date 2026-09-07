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
from ..director import SUPPORTED_GENRES
from ..gamebible import GameBibleDoc
from ..models import GameBibleRow, Job, Project
from ..playtest import PlaytestError, PlaytestUnavailableError
from ..schemas import (
    ConfirmProjectRequest,
    CreateProjectRequest,
    CreateProjectResponse,
    DraftBibleResponse,
    GameBibleOut,
    JobOut,
    PlaytestReportOut,
    ProjectDetailOut,
    ProjectOut,
    UpdateGameBibleRequest,
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


def _validate_bible_for_save(doc: dict) -> dict:
    """Validate a Game Bible that's about to be persisted or shipped.

    Two layers, both honest: the Python mirror (fail fast on a structurally
    broken doc) and the strict TS playtester contract (the real schema — it
    also enforces subset fields the mirror doesn't model, like the delivery
    zone label). Raises 400 with the offending detail, never saves a bad doc.
    """
    try:
        GameBibleDoc.model_validate(doc)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid Game Bible: {exc}") from exc
    genre = doc.get("game", {}).get("genre")
    if genre not in SUPPORTED_GENRES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"unsupported genre '{genre}'. M1 supports: {', '.join(sorted(SUPPORTED_GENRES))}."
            ),
        )
    try:
        # The playtester's "builds" gate is the strict contract check. A doc
        # that doesn't satisfy it would produce a game that can't boot.
        playtest.playtest_bible(doc)
    except PlaytestUnavailableError:
        # Node/CLI not present here — the Python mirror already validated, so
        # don't block an edit just because the strict checker can't run.
        pass
    except PlaytestError as exc:
        raise HTTPException(status_code=400, detail=f"invalid Game Bible: {exc}") from exc
    return doc


def _persist_project(session: Session, doc: dict, prompt: str, mode: str, notes: list[str]) -> Project:
    """Create + persist a project (and its Game Bible + provenance Job)."""
    game = doc["game"]
    slug = _unique_slug(session, slugify(game["slug"]))
    project = Project(
        slug=slug,
        title=game["title"],
        summary=game["one_liner"],
        genre=game["genre"],
        status="draft",
        provenance="ai_generated" if mode == "llm" else "offline_draft",
    )
    project.game_bible = GameBibleRow(schema_version=doc["schemaVersion"], data=doc)
    project.jobs.append(
        Job(
            type="director_draft",
            status="succeeded",
            payload={"prompt": prompt, "mode": mode},
            result={"notes": notes, "slug": slug},
            finished_at=datetime.now(timezone.utc),
        )
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


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

    project = _persist_project(session, result.doc, body.prompt, result.mode, result.notes)
    return CreateProjectResponse(
        project=ProjectOut.model_validate(project),
        game_bible=result.doc,
        mode=result.mode,
        notes=result.notes,
    )


@router.post("/draft", response_model=DraftBibleResponse)
async def draft_game_bible(body: CreateProjectRequest) -> DraftBibleResponse:
    """Review-before-create (M1): draft a Game Bible for inspection, don't persist.

    The Director composes + validates a spec from the prompt and returns it so
    the user can review/edit before committing. Nothing is saved here — the
    confirm endpoint turns a reviewed spec into a real project.
    """
    try:
        result = await generate_game_bible(body.prompt)
    except DirectorUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DirectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return DraftBibleResponse(
        game_bible=result.doc, mode=result.mode, notes=result.notes, prompt=body.prompt
    )


@router.post("/confirm", response_model=CreateProjectResponse, status_code=201)
def confirm_project(
    body: ConfirmProjectRequest, session: Session = Depends(get_session)
) -> CreateProjectResponse:
    """Create a project from a reviewed (possibly user-edited) Game Bible."""
    doc = _validate_bible_for_save(body.game_bible)
    project = _persist_project(session, doc, body.prompt, body.mode, [])
    return CreateProjectResponse(
        project=ProjectOut.model_validate(project),
        game_bible=doc,
        mode=body.mode,
        notes=[],
    )


@router.put("/{slug}/gamebible", response_model=GameBibleOut)
def update_game_bible(
    slug: str, body: UpdateGameBibleRequest, session: Session = Depends(get_session)
) -> GameBibleOut:
    """Replace a project's Game Bible (the Studio editor, M1).

    Re-validated against the real contract before saving; the change is
    recorded as a Job so the edit is honest provenance, not a silent mutation.
    """
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    doc = _validate_bible_for_save(body.game_bible)
    project.game_bible.data = doc
    project.game_bible.schema_version = doc["schemaVersion"]
    project.title = doc["game"]["title"]
    project.summary = doc["game"]["one_liner"]
    project.genre = doc["game"]["genre"]
    project.jobs.append(
        Job(
            type="bible_edit",
            status="succeeded",
            payload={"source": "studio_editor"},
            result={"slug": slug},
            finished_at=datetime.now(timezone.utc),
        )
    )
    session.commit()
    return GameBibleOut(
        project_slug=project.slug,
        schema_version=project.game_bible.schema_version,
        data=project.game_bible.data,
    )
