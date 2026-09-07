"""M3 playtest endpoint tests â€” hermetic (subprocess is mocked, no Node needed)."""

import json
import subprocess

import pytest
from fastapi.testclient import TestClient

from app import playtest
from app.playtest import PlaytestError, PlaytestUnavailableError, playtest_bible

SAMPLE_REPORT = {
    "slug": "scrap-sprint",
    "pass": True,
    "simulatedSeconds": 0,
    "gates": [
        {"gate": "builds", "pass": True, "evidence": "GameBible parsed and rules constructed"},
        {"gate": "boots", "pass": True, "evidence": "boots to title at spawn", "detail": {"timer": 90}},
        {"gate": "controls_work", "pass": True, "evidence": "player.x 480 -> 700"},
        {"gate": "win_reachable", "pass": True, "evidence": "delivered 5/5", "detail": {"score": 500}},
        {"gate": "lose_reachable", "pass": True, "evidence": "idle 90s -> game_over/timer_zero"},
        {"gate": "restart_works", "pass": True, "evidence": "fresh run restored"},
        {
            "gate": "renders",
            "pass": True,
            "evidence": "scene renders: 960x540 canvas, player visible, 5 pickups + 2 hazards, 5 palette colors",
            "detail": {"renderables": 7, "paletteColors": 5, "playerInBounds": True},
        },
    ],
}


def _fake_proc(report: dict, returncode: int = 0) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(
        args=["node", "cli.cjs", "bible.json"],
        returncode=returncode,
        stdout=json.dumps(report),
        stderr="",
    )


def test_playtest_endpoint_returns_report(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(playtest, "playtest_bible", lambda bible: SAMPLE_REPORT)
    r = client.get("/api/v1/projects/scrap-sprint/playtest")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "scrap-sprint"
    assert body["passed"] is True
    assert body["simulated_seconds"] == 0
    assert len(body["gates"]) == 7
    gates = {g["gate"]: g for g in body["gates"]}
    assert gates["win_reachable"]["passed"] is True
    assert gates["win_reachable"]["detail"]["score"] == 500
    assert all("evidence" in g for g in body["gates"])


def test_playtest_unknown_project_404(client: TestClient) -> None:
    assert client.get("/api/v1/projects/does-not-exist/playtest").status_code == 404


def test_playtest_unavailable_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _raise(bible: dict) -> dict:
        raise PlaytestUnavailableError("Node.js is not on PATH")

    monkeypatch.setattr(playtest, "playtest_bible", _raise)
    r = client.get("/api/v1/projects/scrap-sprint/playtest")
    assert r.status_code == 503
    assert "Node" in r.json()["detail"]


def test_playtest_error_returns_500(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise(bible: dict) -> dict:
        raise PlaytestError("playtester failed (exit 2): invalid GameBible")

    monkeypatch.setattr(playtest, "playtest_bible", _raise)
    r = client.get("/api/v1/projects/scrap-sprint/playtest")
    assert r.status_code == 500
    assert "playtester failed" in r.json()["detail"]


def test_playtest_bible_parses_cli_output(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    """The bridge parses the CLI's stdout JSON and accepts exit codes 0 and 1."""
    monkeypatch.setattr(playtest, "_ensure_runnable", lambda: "node")
    monkeypatch.setattr(
        playtest.subprocess, "run", lambda *a, **k: _fake_proc(SAMPLE_REPORT, returncode=1)
    )
    report = playtest_bible({"game": {"slug": "scrap-sprint"}})
    assert report["pass"] is True
    assert len(report["gates"]) == 7


def test_playtest_bible_raises_on_bad_exit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(playtest, "_ensure_runnable", lambda: "node")
    bad = subprocess.CompletedProcess(args=[], returncode=2, stdout="", stderr="invalid GameBible")
    monkeypatch.setattr(playtest.subprocess, "run", lambda *a, **k: bad)
    with pytest.raises(PlaytestError):
        playtest_bible({"game": {"slug": "x"}})


def test_playtest_bible_end_to_end(client: TestClient) -> None:
    """Run the REAL playtester CLI against the seeded sample bible.

    Skipped when Node or the built CLI isn't present (e.g. a Python-only CI
    job) â€” the mocked tests above still pin the bridge's contract. When it
    does run, it proves the full seam: DB bible -> node cli.cjs -> report.
    """
    from app.gamebible import load_sample_game_bible  # same doc the seed persists

    try:
        report = playtest_bible(load_sample_game_bible())
    except PlaytestUnavailableError:
        pytest.skip("node or built playtester CLI not available here")

    assert report["slug"] == "scrap-sprint"
    assert report["pass"] is True
    gates = {g["gate"]: g["pass"] for g in report["gates"]}
    assert set(gates) == {
        "builds",
        "boots",
        "controls_work",
        "win_reachable",
        "lose_reachable",
        "restart_works",
        "renders",
        "performance",
    }
    assert all(gates.values())
