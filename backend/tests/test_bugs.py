"""M4 tests: Bug -> Fix -> Regression. Hermetic (playtester subprocess mocked)."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import sessionmaker

from app import playtest
from app.models import Bug

BASE = "/api/v1/projects/scrap-sprint"

# The 6 playtester gates. The seeded sample game passes all of them when healthy.
def _report(win_pass: bool) -> dict:
    return {
        "slug": "scrap-sprint",
        "pass": win_pass,
        "simulatedSeconds": 0,
        "gates": [
            {"gate": "builds", "pass": True, "evidence": "GameBible parsed"},
            {"gate": "boots", "pass": True, "evidence": "boots to title"},
            {"gate": "controls_work", "pass": True, "evidence": "player moves"},
            {
                "gate": "win_reachable",
                "pass": win_pass,
                "evidence": "delivered 5/5" if win_pass else "no clear path to delivery zone",
            },
            {"gate": "lose_reachable", "pass": True, "evidence": "idle -> game_over"},
            {"gate": "restart_works", "pass": True, "evidence": "fresh run restored"},
        ],
    }


@pytest.fixture(autouse=True)
def clean_bugs(client: TestClient):
    """Isolate the bug table between tests (the shared session DB is not wiped)."""
    engine = create_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(bind=engine)
    with Session() as s:
        s.execute(delete(Bug))
        s.commit()
    yield
    with Session() as s:
        s.execute(delete(Bug))
        s.commit()


@pytest.fixture()
def broken_then_fixed(monkeypatch: pytest.MonkeyPatch):
    """A controllable playtester: starts broken (win fails), can be flipped to fixed."""
    state = {"win": False}
    monkeypatch.setattr(playtest, "playtest_bible", lambda bible: _report(state["win"]))
    return state


def test_record_bug_from_failing_gate(client: TestClient, broken_then_fixed) -> None:
    r = client.post(
        f"{BASE}/bugs",
        json={"gate": "win_reachable", "evidence": "no clear path to delivery zone"},
    )
    assert r.status_code == 201
    bug = r.json()
    assert bug["gate"] == "win_reachable"
    assert bug["status"] == "open"
    assert bug["evidence"] == "no clear path to delivery zone"
    assert bug["project_slug"] == "scrap-sprint"
    assert bug["fixed_at"] is None

    # It shows up in the bug list.
    bugs = client.get(f"{BASE}/bugs").json()
    assert [b["id"] for b in bugs] == [bug["id"]]


def test_retest_open_bug_still_failing_stays_open(client: TestClient, broken_then_fixed) -> None:
    bug = client.post(f"{BASE}/bugs", json={"gate": "win_reachable"}).json()
    r = client.post(f"{BASE}/bugs/{bug['id']}/retest")
    assert r.status_code == 200
    body = r.json()
    assert body["gate_passed"] is False
    assert body["fixed_now"] is False
    assert body["bug"]["status"] == "open"
    assert body["bug"]["fixed_at"] is None


def test_fix_flips_bug_and_freezes_regression(client: TestClient, broken_then_fixed) -> None:
    bug = client.post(f"{BASE}/bugs", json={"gate": "win_reachable"}).json()
    # Simulate the fix: the playtester now reports win_reachable passing.
    broken_then_fixed["win"] = True
    r = client.post(f"{BASE}/bugs/{bug['id']}/retest")
    body = r.json()
    assert body["gate_passed"] is True
    assert body["fixed_now"] is True
    assert body["bug"]["status"] == "fixed"
    assert body["bug"]["fixed_at"] is not None

    # A second retest on an already-fixed bug does not report fixed_now again.
    again = client.post(f"{BASE}/bugs/{bug['id']}/retest").json()
    assert again["fixed_now"] is False
    assert again["bug"]["status"] == "fixed"


def test_regression_suite_replays_fixed_bugs(client: TestClient, broken_then_fixed) -> None:
    bug = client.post(f"{BASE}/bugs", json={"gate": "win_reachable"}).json()
    broken_then_fixed["win"] = True
    client.post(f"{BASE}/bugs/{bug['id']}/retest")

    suite = client.get(f"{BASE}/regressions").json()
    assert suite["project_slug"] == "scrap-sprint"
    assert suite["total"] == 1
    assert suite["passing"] == 1
    assert suite["all_passing"] is True
    case = suite["regressions"][0]
    assert case["bug_id"] == bug["id"]
    assert case["gate"] == "win_reachable"
    assert case["passed"] is True


def test_regression_detects_reopened_failure(client: TestClient, broken_then_fixed) -> None:
    """The whole point: a 'fixed' bug that regresses is caught by the suite."""
    bug = client.post(f"{BASE}/bugs", json={"gate": "win_reachable"}).json()
    broken_then_fixed["win"] = True
    client.post(f"{BASE}/bugs/{bug['id']}/retest")
    # Regression: the gate starts failing again.
    broken_then_fixed["win"] = False
    suite = client.get(f"{BASE}/regressions").json()
    assert suite["total"] == 1
    assert suite["passing"] == 0
    assert suite["all_passing"] is False
    assert suite["regressions"][0]["passed"] is False


def test_empty_regression_suite_is_trivially_passing(client: TestClient) -> None:
    suite = client.get(f"{BASE}/regressions").json()
    assert suite["total"] == 0
    assert suite["all_passing"] is True


def test_bug_endpoints_404s(client: TestClient) -> None:
    assert client.get("/api/v1/projects/nope/bugs").status_code == 404
    assert client.post("/api/v1/projects/nope/bugs", json={"gate": "win_reachable"}).status_code == 404
    assert client.post(f"{BASE}/bugs/9999/retest").status_code == 404
    assert client.get("/api/v1/projects/nope/regressions").status_code == 404
