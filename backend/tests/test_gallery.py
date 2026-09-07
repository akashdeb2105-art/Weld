"""M6 tests: public gallery feed (GET /projects/published). Hermetic (no playtester)."""

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker

from app.models import Project

PUBLISHED_URL = "/api/v1/projects/published"
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


@pytest.fixture(autouse=True)
def clean():
    _set_published(False)
    yield
    _set_published(False)


def test_gallery_empty_when_nothing_published(client: TestClient) -> None:
    """The honest empty state: no published games -> empty list, not fake entries."""
    r = client.get(PUBLISHED_URL)
    assert r.status_code == 200
    assert r.json() == []


def test_gallery_excludes_unpublished(client: TestClient) -> None:
    """A private draft is never surfaced by the gallery (honest by construction)."""
    _set_published(False)
    r = client.get(PUBLISHED_URL)
    assert r.status_code == 200
    assert all(g["slug"] != "scrap-sprint" for g in r.json())


def test_gallery_lists_published_game(client: TestClient) -> None:
    """A published game appears with exactly the public fields a share page needs."""
    _set_published(True)
    r = client.get(PUBLISHED_URL)
    assert r.status_code == 200
    games = r.json()
    slugs = [g["slug"] for g in games]
    assert "scrap-sprint" in slugs
    entry = next(g for g in games if g["slug"] == "scrap-sprint")
    assert set(entry.keys()) == {"slug", "title", "summary", "genre", "published_at"}
    assert entry["published_at"] is not None


def test_gallery_route_not_swallowed_by_slug(client: TestClient) -> None:
    """`/published` resolves to the listing route, not the `/{slug}` detail route.

    If the route were registered after `/{slug}`, FastAPI would try to look up a
    project literally named 'published' and 404. This pins the route ordering.
    """
    r = client.get(PUBLISHED_URL)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
