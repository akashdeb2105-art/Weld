"""Pydantic API schemas — the wire contract (blueprint §53)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


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
    # The ORM `game_bible` relationship is a GameBibleRow; the API exposes the
    # raw GameBible document it holds (row.data), not the row wrapper.
    game_bible: dict | None
    jobs: list[JobOut]

    @field_validator("game_bible", mode="before")
    @classmethod
    def _unwrap_row(cls, v: Any) -> Any:
        if v is None or isinstance(v, dict):
            return v
        return getattr(v, "data", None)


class GameBibleOut(BaseModel):
    project_slug: str
    schema_version: int
    data: dict


class CreateProjectRequest(BaseModel):
    """The Game Director's input (M1): a plain-language game idea."""

    prompt: str = Field(min_length=8, max_length=2000)


class CreateProjectResponse(BaseModel):
    """The Director's draft: a persisted project plus how it was made."""

    project: ProjectOut
    game_bible: dict
    mode: str  # "llm" | "offline"
    notes: list[str]
