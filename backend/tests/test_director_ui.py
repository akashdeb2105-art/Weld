"""M1 UI backend: review-before-create (draft/confirm) + Studio bible editor (update).

The Director is hermetic in tests (no LLM keys), so draft/confirm use the
deterministic offline composer. The strict TS playtester check inside
`_validate_bible_for_save` is stubbed where we test the HTTP contract, and run
for real in the end-to-end test (skipped when Node/CLI is absent).
"""

import copy

import pytest
from fastapi.testclient import TestClient

from app import playtest
from app.gamebible import load_sample_game_bible

PROMPT = "A top-down arcade game where you collect glowing mushrooms and dodge acid pools."


def test_draft_returns_bible_without_persisting(client: TestClient) -> None:
    before = client.get("/api/v1/projects").json()
    r = client.post("/api/v1/projects/draft", json={"prompt": PROMPT})
    assert r.status_code == 200
    body = r.json()
    assert body["prompt"] == PROMPT
    assert body["mode"] == "offline"
    assert body["game_bible"]["schemaVersion"] == 1
    assert body["game_bible"]["win_condition"]["target"] >= 1
    # Nothing persisted: the project list is unchanged.
    after = client.get("/api/v1/projects").json()
    assert len(after) == len(before)


def test_draft_rejects_short_prompt(client: TestClient) -> None:
    assert client.post("/api/v1/projects/draft", json={"prompt": "hi"}).status_code == 422


def test_confirm_creates_project_from_reviewed_bible(client: TestClient) -> None:
    draft = client.post("/api/v1/projects/draft", json={"prompt": PROMPT}).json()
    bible = draft["game_bible"]
    # User edits during review: rename the title + bump the win target.
    bible["game"]["title"] = "Mushroom Run Deluxe"
    bible["win_condition"]["target"] = 7

    r = client.post(
        "/api/v1/projects/confirm",
        json={"game_bible": bible, "prompt": PROMPT, "mode": draft["mode"]},
    )
    assert r.status_code == 201
    body = r.json()
    slug = body["project"]["slug"]
    assert body["project"]["title"] == "Mushroom Run Deluxe"
    # The edited spec is what's actually persisted + served back.
    served = client.get(f"/api/v1/projects/{slug}/gamebible").json()
    assert served["data"]["win_condition"]["target"] == 7
    assert served["data"]["game"]["title"] == "Mushroom Run Deluxe"


def test_confirm_rejects_invalid_bible(client: TestClient) -> None:
    draft = client.post("/api/v1/projects/draft", json={"prompt": PROMPT}).json()
    bible = draft["game_bible"]
    bible["game"]["genre"] = "unsupported_genre"
    r = client.post("/api/v1/projects/confirm", json={"game_bible": bible})
    assert r.status_code == 400
    assert "genre" in r.json()["detail"].lower()


def test_update_gamebible_roundtrip(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Stub only the strict TS check; the Python mirror still validates.
    monkeypatch.setattr(playtest, "playtest_bible", lambda doc: {"pass": True})
    bible = client.get("/api/v1/projects/scrap-sprint/gamebible").json()["data"]
    edited = copy.deepcopy(bible)
    edited["win_condition"]["target"] = 9
    edited["game"]["title"] = "Scrap Sprint Turbo"

    r = client.put("/api/v1/projects/scrap-sprint/gamebible", json={"game_bible": edited})
    assert r.status_code == 200
    assert r.json()["data"]["win_condition"]["target"] == 9

    # Project metadata follows the bible.
    project = client.get("/api/v1/projects/scrap-sprint").json()
    assert project["title"] == "Scrap Sprint Turbo"
    # The edit is recorded as an honest provenance job.
    assert any(j["type"] == "bible_edit" for j in project["jobs"])


def test_update_gamebible_rejects_structurally_invalid(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", lambda doc: {"pass": True})
    bible = client.get("/api/v1/projects/scrap-sprint/gamebible").json()["data"]
    del bible["win_condition"]  # breaks the real contract
    r = client.put("/api/v1/projects/scrap-sprint/gamebible", json={"game_bible": bible})
    assert r.status_code == 400


def test_update_gamebible_unknown_project_404(client: TestClient) -> None:
    r = client.put(
        "/api/v1/projects/does-not-exist/gamebible", json={"game_bible": {"x": 1}}
    )
    assert r.status_code == 404


def test_edited_bible_passes_real_playtest(client: TestClient) -> None:
    """End-to-end: edit the sample bible's win target, run the REAL playtester.

    Proves an edit the user makes in the Studio editor still produces a game
    that passes its gates. Skipped when Node/CLI isn't available (CI without
    the JS build); the stubbed tests above pin the HTTP contract regardless.
    """
    bible = load_sample_game_bible()
    edited = copy.deepcopy(bible)
    edited["win_condition"]["target"] = 3  # easier target still winnable
    try:
        report = playtest.playtest_bible(edited)
    except playtest.PlaytestUnavailableError:
        pytest.skip("node or built playtester CLI not available here")
    gates = {g["gate"]: g["pass"] for g in report["gates"]}
    assert gates.get("builds") is True
    assert gates.get("win_reachable") is True
