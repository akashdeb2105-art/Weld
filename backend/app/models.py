"""SQLAlchemy models. Minimal for M0 (blueprint §55: keep it minimal in V1)."""

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, default="")
    genre: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(40), default="draft")
    provenance: Mapped[str] = mapped_column(String(40), default="deterministic_sample")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    game_bible: Mapped["GameBibleRow"] = relationship(
        back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    bugs: Mapped[list["Bug"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class GameBibleRow(Base):
    __tablename__ = "game_bibles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="game_bible")


class Job(Base):
    """Long-running work record (blueprint §78). M0 records only deterministic
    seeds; the real engine fills this in from M1 onward."""

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(40), default="queued")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="jobs")


class Bug(Base):
    """A quality-gate failure captured as a regression (M4: Bug -> Fix -> Regression).

    The honest loop: a playtester gate fails, we record it as a Bug with the
    gate's evidence; a fix edits the bible; retesting flips the bug to fixed
    and freezes a *replayable* regression case (the exact broken bible + the
    gate that must now pass). The regression suite is the set of fixed bugs --
    replaying it re-runs the playtester against each frozen case and asserts
    the gate still passes, so a fixed bug can never silently come back.
    """

    __tablename__ = "bugs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    gate: Mapped[str] = mapped_column(String(60))
    summary: Mapped[str] = mapped_column(Text, default="")
    evidence: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="open")  # open | fixed
    # The bible exactly as it failed. Frozen at record time so the regression
    # stays meaningful even after the project's live bible is fixed.
    broken_bible: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    fixed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="bugs")
