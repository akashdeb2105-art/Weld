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


class PlaytestGateOut(BaseModel):
    """One quality-gate verdict from the Playtester (M3)."""

    gate: str
    passed: bool = Field(validation_alias="pass")
    evidence: str
    detail: dict | None = None


class PlaytestReportOut(BaseModel):
    """The full evidence-backed playtest report for a project's GameBible."""

    slug: str
    passed: bool = Field(validation_alias="pass")
    gates: list[PlaytestGateOut]
    simulated_seconds: float = Field(validation_alias="simulatedSeconds")


class CreateProjectRequest(BaseModel):
    """The Game Director's input (M1): a plain-language game idea."""

    prompt: str = Field(min_length=8, max_length=2000)


class CreateProjectResponse(BaseModel):
    """The Director's draft: a persisted project plus how it was made."""

    project: ProjectOut
    game_bible: dict
    mode: str  # "llm" | "offline"
    notes: list[str]


class DraftBibleResponse(BaseModel):
    """A Director-drafted Game Bible for review — not yet a project (M1).

    The "review before create" step: the user inspects/edits this spec, then
    confirms by POSTing it back to create the project. Nothing is persisted
    until that confirm, so reviewing is always free.
    """

    game_bible: dict
    mode: str  # "llm" | "offline"
    notes: list[str]
    prompt: str


class ConfirmProjectRequest(BaseModel):
    """Create a project from a reviewed (possibly user-edited) Game Bible."""

    game_bible: dict
    prompt: str = Field(default="", max_length=2000)
    mode: str = Field(default="offline")  # carried from the draft for provenance


class UpdateGameBibleRequest(BaseModel):
    """Replace a project's Game Bible (the Studio editor, M1).

    The full document is replaced (not patched) and re-validated against the
    real contract before it is saved, so a broken edit can never be persisted.
    """

    game_bible: dict


#  M2 Game Builder 


class BuildManifestOut(BaseModel):
    """The Game Builder's artifact (M2): what the bible compiled to.

    Deterministic and content-addressed: the same bible always yields the same
    `content_hash` / `artifact_id`, so a rebuild after an edit is detectable.
    """

    artifact_id: str
    content_hash: str
    runtime: dict  # {"id": ..., "version": ...}
    schema_version: int
    slug: str | None
    title: str | None
    genre: str | None
    armed: dict  # win/lose/controls the runtime will enforce
    level: dict
    palette: list[str]
    evidence: str


class BuildResponse(BaseModel):
    """Result of running the Builder: the manifest plus the project's status."""

    project: ProjectOut
    manifest: BuildManifestOut
    reused: bool  # True when the bible was unchanged and the prior build was reused
