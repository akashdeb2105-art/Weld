"""M6 tests: Community/Remix. Hermetic (no playtester subprocess needed)."""

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker

from app.models import Project

BASE = "/api/v1/projects/scrap-sprint"


def _set_published(published: bool) -> None:
    """Flip the seeded project's published flag directly (no playtester call)."""
    engine = create_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(bind=engine)
    with Session() as s:
        s.execute(
            update(Project).values(
                published=published,
                published_at=datetime.now(timezone.utc) if published else None,
            )
        )
        s.commit()


def _delete_remixes() -> None:
    """Remove any remix clones so tests don't collide on unique slugs."""
    engine = create_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(bind=engine)
    with Session() as s:
        for p in s.scalars(select(Project).where(Project.slug.like("scrap-sprint-remix%"))):
            s.delete(p)
        s.commit()


@pytest.fixture(autouse=True)
def clean():
    _delete_remixes()
    _set_published(False)
    yield
    _delete_remixes()
    _set_published(False)


def test_remix_requires_published(client: TestClient) -> None:
    """An unpublished game cannot be remixed (honest: only the public thing)."""
    r = client.post(f"{BASE}/remix")
    assert r.status_code == 409
    assert "only published games" in r.json()["detail"]


def test_remix_unknown_project_404(client: TestClient) -> None:
    assert client.post("/api/v1/projects/nope/remix").status_code == 404


def test_remix_clones_published_game(client: TestClient) -> None:
    _set_published(True)
    r = client.post(f"{BASE}/remix")
    assert r.status_code == 201
    body = r.json()
    assert body["remixed_from"] == "scrap-sprint"

    clone = body["project"]
    assert clone["slug"] == "scrap-sprint-remix"
    assert clone["provenance"] == "remix"
    assert clone["status"] == "draft"
    assert clone["published"] is False  # the copy is private, not auto-shipped
    assert "(Remix)" in clone["title"]
    assert body["studio_path"] == f"/app/studio/{clone['slug']}"

    # The clone's bible is internally consistent + provenance-marked.
    bible = client.get(f"/api/v1/projects/{clone['slug']}/gamebible").json()["data"]
    assert bible["game"]["slug"] == clone["slug"]
    assert "(Remix)" in bible["game"]["title"]
    assert bible["provenance"]["origin"] == "remixed"
    assert "scrap-sprint" in bible["provenance"]["notes"]

    # The original is untouched and still published.
    src = client.get(BASE).json()
    assert src["slug"] == "scrap-sprint"
    assert src["published"] is True


def test_remix_unique_slug_on_repeat(client: TestClient) -> None:
    _set_published(True)
    first = client.post(f"{BASE}/remix").json()["project"]["slug"]
    second = client.post(f"{BASE}/remix").json()["project"]["slug"]
    assert first == "scrap-sprint-remix"
    assert second != first  # never overwrites the first clone
    assert second.startswith("scrap-sprint-remix-")
