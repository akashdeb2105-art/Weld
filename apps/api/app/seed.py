"""Seed the deterministic sample project.

Idempotent: upserts by slug, so it's safe to run on every boot. The seeded
rows are *clearly labeled* as deterministic sample data (blueprint §73: no
fake features — this is honest sample state, not fake AI output).
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .gamebible import load_sample_game_bible
from .models import GameBibleRow, Job, Project


def seed_sample_project(session: Session) -> Project:
    bible = load_sample_game_bible()

    project = session.scalar(select(Project).where(Project.slug == "scrap-sprint"))
    if project is None:
        project = Project(slug="scrap-sprint", title="Scrap Sprint")
        session.add(project)

    project.title = bible["game"]["title"]
    project.summary = bible["game"]["one_liner"]
    project.genre = bible["game"]["genre"]
    project.status = "verified"  # deterministic sample passes its own tests
    project.provenance = bible["provenance"]["origin"]

    if project.game_bible is None:
        project.game_bible = GameBibleRow(schema_version=bible["schemaVersion"], data=bible)
    else:
        project.game_bible.schema_version = bible["schemaVersion"]
        project.game_bible.data = bible

    # One honest seed job record: the deterministic build of the sample game.
    if not any(j.type == "deterministic_sample_build" for j in project.jobs):
        project.jobs.append(
            Job(
                type="deterministic_sample_build",
                status="succeeded",
                payload={"engine": "phaser", "source": "packages/sample-game"},
                result={"note": "Reference game built deterministically; not AI-generated."},
                finished_at=datetime.now(timezone.utc),
            )
        )

    session.commit()
    session.refresh(project)
    return project
