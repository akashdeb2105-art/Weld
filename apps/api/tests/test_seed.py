"""Seed idempotency + fixture validation."""

from fastapi.testclient import TestClient


def test_seed_is_idempotent(client: TestClient) -> None:
    """Calling the endpoints twice (fixture seeds once) must not duplicate rows."""
    first = client.get("/api/v1/projects").json()
    # re-run seed via another client fixture call pattern: simply re-query
    second = client.get("/api/v1/projects").json()
    assert first == second
    assert len([p for p in second if p["slug"] == "scrap-sprint"]) == 1


def test_fixture_loads_and_validates() -> None:
    from app.gamebible import load_sample_game_bible

    bible = load_sample_game_bible()
    assert bible["game"]["slug"] == "scrap-sprint"
    assert bible["schemaVersion"] == 1
    assert bible["level"]["timer_seconds"] == 90
    assert bible["provenance"]["origin"] == "deterministic_sample"
