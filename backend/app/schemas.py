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
    published: bool
    published_at: datetime | None
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


#  M4 Bug -> Fix -> Regression


class RecordBugRequest(BaseModel):
    """Capture a failed playtest gate as a bug (M4).

    The client sends the gate's verdict from the playtest report it just saw,
    so the recorded evidence is exactly what the Playtester reported -- never
    re-run or reinterpreted at record time.
    """

    gate: str = Field(min_length=1, max_length=60)
    summary: str = Field(default="", max_length=400)
    evidence: str = Field(default="", max_length=2000)


class BugOut(BaseModel):
    """A recorded quality-gate failure and its regression state."""

    id: int
    project_slug: str
    gate: str
    summary: str
    evidence: str
    status: str  # "open" | "fixed"
    created_at: datetime
    fixed_at: datetime | None


class RetestResponse(BaseModel):
    """Retest a bug against the project's current bible (M4).

    `fixed_now` is True only when the gate that failed now passes against the
    live bible -- an honest flip, not an assumed one. When True the bug freezes
    its broken bible as a replayable regression case.
    """

    bug: BugOut
    fixed_now: bool
    gate_passed: bool
    evidence: str


class RegressionCaseResult(BaseModel):
    """One replayed regression case: does the frozen broken scenario still pass
    the gate it originally failed, under the current engine?"""

    bug_id: int
    gate: str
    passed: bool
    evidence: str


class RegressionSuiteOut(BaseModel):
    """Replay of every fixed bug's frozen regression case (M4)."""

    project_slug: str
    total: int
    passing: int
    regressions: list[RegressionCaseResult]
    all_passing: bool


#  M5 Publish


class PublishResponse(BaseModel):
    """The publish verdict (M5).

    Publishing is gate-guarded: it only succeeds when the Playtester proves
    every quality gate against the current bible. `already` is True when the
    game was already published (idempotent re-publish, not a fake new ship).
    """

    project: ProjectOut
    published: bool
    already: bool
    playtest_passed: bool
    share_path: str  # the public URL path (e.g. /play/<slug>)


class PublicGameOut(BaseModel):
    """The public, published view of a game (M5).

    Only what a share page needs -- no internal jobs/bugs. 404s unless the
    project is actually published, so an unpublished game is never served.
    """

    slug: str
    title: str
    summary: str
    genre: str
    published_at: datetime | None


class RemixResponse(BaseModel):
    """The result of remixing a published game (M6 Community/Remix).

    Remixing clones a *published* game into a brand-new, private draft the
    user can edit freely. Honest provenance: the copy is marked
    `remix`, points back at its source, starts unpublished, and never touches
    the original. `studio_path` is where the new draft opens.
    """

    project: ProjectOut
    remixed_from: str
    studio_path: str  # where the new editable draft opens (e.g. /app/studio/<slug>)
