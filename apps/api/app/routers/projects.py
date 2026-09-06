from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Job, Project
from ..schemas import GameBibleOut, JobOut, ProjectDetailOut, ProjectOut

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
