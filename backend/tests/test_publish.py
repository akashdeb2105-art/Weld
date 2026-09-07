"""M5 tests: gate-guarded Publish. Hermetic (playtester subprocess mocked)."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker

from app import playtest
from app.models import Project

BASE = "/api/v1/projects/scrap-sprint"


def _report(all_pass: bool) -> dict:
    return {
        "slug": "scrap-sprint",
        "pass": all_pass,
        "simulatedSeconds": 0,
        "gates": [
            {"gate": "builds", "pass": True, "evidence": "GameBible parsed"},
            {"gate": "boots", "pass": True, "evidence": "boots to title"},
            {"gate": "controls_work", "pass": True, "evidence": "player moves"},
            {
                "gate": "win_reachable",
                "pass": all_pass,
                "evidence": "delivered 5/5" if all_pass else "no clear path",
            },
            {"gate": "lose_reachable", "pass": True, "evidence": "idle -> game_over"},
            {"gate": "restart_works", "pass": True, "evidence": "fresh run restored"},
        ],
    }


@pytest.fixture(autouse=True)
def unpublished():
    """Reset the seeded project to unpublished before/after each test."""
    engine = create_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(bind=engine)
    with Session() as s:
        s.execute(update(Project).values(published=False, published_at=None))
        s.commit()
    yield
    with Session() as s:
        s.execute(update(Project).values(published=False, published_at=None))
        s.commit()


@pytest.fixture()
def passing(monkeypatch: pytest.MonkeyPatch):
    state = {"ok": True}
    monkeypatch.setattr(playtest, "playtest_bible", lambda bible: _report(state["ok"]))
    return state


def test_publish_refused_when_gates_fail(client: TestClient, passing) -> None:
    passing["ok"] = False
    r = client.post(f"{BASE}/publish")
    assert r.status_code == 409
    assert "quality gates failing" in r.json()["detail"]
    assert "win_reachable" in r.json()["detail"]
    # Not published.
    assert client.get(f"{BASE}/public").status_code == 404


def test_publish_succeeds_when_all_gates_pass(client: TestClient, passing) -> None:
    r = client.post(f"{BASE}/publish")
    assert r.status_code == 200
    body = r.json()
    assert body["published"] is True
    assert body["already"] is False
    assert body["playtest_passed"] is True
    assert body["share_path"] == "/play/scrap-sprint"
    assert body["project"]["published"] is True
    assert body["project"]["published_at"] is not None

    # The public endpoint now serves the game.
    pub = client.get(f"{BASE}/public")
    assert pub.status_code == 200
    assert pub.json()["slug"] == "scrap-sprint"
    assert pub.json()["title"]


def test_republish_is_idempotent(client: TestClient, passing) -> None:
    client.post(f"{BASE}/publish")
    again = client.post(f"{BASE}/publish").json()
    assert again["published"] is True
    assert again["already"] is True


def test_unpublished_game_public_endpoint_404s(client: TestClient) -> None:
    r = client.get(f"{BASE}/public")
    assert r.status_code == 404
    assert "not published" in r.json()["detail"]


def test_publish_unknown_project_404(client: TestClient) -> None:
    assert client.post("/api/v1/projects/nope/publish").status_code == 404
