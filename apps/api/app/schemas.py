"""Pydantic API schemas — the wire contract (blueprint §53)."""

from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str


class JobOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    type: str
    status: str
    payload: dict
    result: dict
    error: str | None
    created_at: datetime
    finished_at: datetime | None


class ProjectOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    slug: str
    title: str
    summary: str
    genre: str
    status: str
    provenance: str
    created_at: datetime
    updated_at: datetime


class ProjectDetailOut(ProjectOut):
    game_bible: dict | None
    jobs: list[JobOut]


class GameBibleOut(BaseModel):
    project_slug: str
    schema_version: int
    data: dict
