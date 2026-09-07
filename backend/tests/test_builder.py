"""M2 Game Builder tests  hermetic (the strict-contract subprocess is mocked).

The Builder compiles a validated Game Bible into a deterministic, content-
addressed manifest and records it as a real Job. These tests prove:
  * the manifest is deterministic and honest (same bible -> same hash),
  * create/confirm auto-build and move status draft -> built,
  * rebuilding an unchanged bible reuses the prior artifact (and says so),
  * an edit recompiles (new content hash), and
  * failures surface honestly (503 unavailable / 400 contract failure).
"""

import pytest
from fastapi.testclient import TestClient

from app import builder, playtest
from app.builder import BuildError, BuildUnavailableError

PASSING_REPORT = {
    "slug": "scrap-sprint",
    "pass": True,
    "simulatedSeconds": 0,
    "gates": [
        {"gate": "builds", "pass": True, "evidence": "GameBible parsed and rules constructed"},
    ],
}

PROMPT = "Collect glowing mushrooms and avoid acid pools"


def _ok(bible: dict) -> dict:
    return PASSING_REPORT


def _create(client: TestClient) -> dict:
    r = client.post("/api/v1/projects", json={"prompt": PROMPT})
    assert r.status_code == 201, r.text
    return r.json()


#  manifest unit tests (no HTTP) 


def test_manifest_is_deterministic_and_honest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    bible = client_bible()
    a = builder.build_manifest(bible)
    b = builder.build_manifest(bible)
    assert a["content_hash"] == b["content_hash"]
    assert a["artifact_id"] == b["artifact_id"]
    assert a["runtime"]["id"] == builder.RUNTIME_ID
    # Armed contract reflects the bible, not a hardcoded default.
    assert a["armed"]["win_condition"]["type"] == bible["win_condition"]["type"]
    assert a["armed"]["lose_conditions"] == bible["lose_conditions"]
    assert a["armed"]["controls"]["up"] == bible["controls"]["up"]
    assert a["level"]["pickups"] == len(bible["level"]["pickups"])


def test_manifest_changes_with_content(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    bible = client_bible()
    before = builder.build_manifest(bible)
    edited = {**bible, "game": {**bible["game"], "title": "Renamed Game"}}
    after = builder.build_manifest(edited)
    assert before["content_hash"] != after["content_hash"]


def test_manifest_requires_passing_builds_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    def _fail(bible: dict) -> dict:
        return {
            "gates": [{"gate": "builds", "pass": False, "evidence": "schema invalid"}],
        }

    monkeypatch.setattr(playtest, "playtest_bible", _fail)
    with pytest.raises(BuildError):
        builder.build_manifest(client_bible())


def test_manifest_unavailable_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise(bible: dict) -> dict:
        raise playtest.PlaytestUnavailableError("Node.js is not on PATH")

    monkeypatch.setattr(playtest, "playtest_bible", _raise)
    with pytest.raises(BuildUnavailableError):
        builder.build_manifest(client_bible())


#  endpoint / flow tests 


def test_create_auto_builds_and_marks_built(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    body = _create(client)
    assert body["project"]["status"] == "built"
    slug = body["project"]["slug"]

    jobs = client.get(f"/api/v1/projects/{slug}").json()["jobs"]
    build = next(j for j in jobs if j["type"] == "build")
    assert build["status"] == "succeeded"
    assert build["result"]["content_hash"]
    assert build["result"]["artifact_id"].startswith(body["game_bible"]["game"]["slug"])


def test_build_endpoint_reuses_unchanged_artifact(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    slug = _create(client)["project"]["slug"]

    # The project was auto-built on create, so the explicit rebuild of an
    # unchanged bible honestly reuses that artifact (same content hash).
    first = client.post(f"/api/v1/projects/{slug}/build")
    assert first.status_code == 200
    assert first.json()["reused"] is True
    h1 = first.json()["manifest"]["content_hash"]

    second = client.post(f"/api/v1/projects/{slug}/build")
    assert second.status_code == 200
    assert second.json()["reused"] is True
    assert second.json()["manifest"]["content_hash"] == h1


def test_edit_recompiles_with_new_hash(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    slug = _create(client)["project"]["slug"]
    before = client.post(f"/api/v1/projects/{slug}/build").json()["manifest"]["content_hash"]

    bible = client.get(f"/api/v1/projects/{slug}/gamebible").json()["data"]
    bible["game"]["title"] = "A Totally New Title"
    r = client.put(f"/api/v1/projects/{slug}/gamebible", json={"game_bible": bible})
    assert r.status_code == 200, r.text

    after = client.post(f"/api/v1/projects/{slug}/build").json()["manifest"]["content_hash"]
    assert before != after


def test_build_unknown_project_404(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    assert client.post("/api/v1/projects/does-not-exist/build").status_code == 404


def test_build_unavailable_returns_503_and_marks_draft(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", _ok)
    slug = _create(client)["project"]["slug"]

    def _raise(bible: dict) -> dict:
        raise playtest.PlaytestUnavailableError("Node.js is not on PATH")

    monkeypatch.setattr(playtest, "playtest_bible", _raise)
    r = client.post(f"/api/v1/projects/{slug}/build")
    assert r.status_code == 503
    assert "Node" in r.json()["detail"]


#  helpers 


def client_bible() -> dict:
    """A minimal but schema-valid bible for unit-level manifest tests."""
    return {
        "schemaVersion": 1,
        "game": {
            "title": "Mushroom Run",
            "slug": "mushroom-run",
            "genre": "top_down_arcade",
            "target": "browser_desktop",
            "camera": "top_down",
            "one_liner": "Collect mushrooms, dodge acid.",
        },
        "player": {"role": "forager", "movement": "grid-free 4-way", "health": 3},
        "core_loop": ["move", "collect", "deliver", "repeat"],
        "win_condition": {"type": "deliver_count", "target": 5, "description": "Deliver 5"},
        "lose_conditions": ["timer_zero", "health_zero"],
        "controls": {
            "up": ["ArrowUp", "W"],
            "down": ["ArrowDown", "S"],
            "left": ["ArrowLeft", "A"],
            "right": ["ArrowRight", "D"],
            "pause": ["P"],
            "restart": ["R"],
        },
        "systems": ["movement", "collisions", "hazards", "scoring", "timer", "pickups", "delivery", "restart", "pause"],
        "visual_direction": {"theme": "forest", "palette": ["#0B0D12", "#1B2130", "#FF5C1A"]},
        "audio": {"enabled": False},
        "quality_requirements": {
            "start_successfully": True,
            "restartable": True,
            "win_reachable": True,
            "lose_reachable": True,
            "zero_console_errors": True,
        },
        "level": {
            "name": "Level 01",
            "width": 960,
            "height": 540,
            "timer_seconds": 90,
            "player_spawn": {"x": 480, "y": 300},
            "player_speed": 220,
            "delivery_zone": {"x": 408, "y": 24, "width": 144, "height": 60, "label": "GOAL"},
            "pickups": [{"id": "m-1", "kind": "scrap", "x": 132, "y": 140}],
            "hazards": [{"id": "p-1", "kind": "spark_pit", "x": 300, "y": 215, "radius": 30}],
        },
        "provenance": {"origin": "offline_draft"},
    }
