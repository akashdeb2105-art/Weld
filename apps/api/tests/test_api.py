"""M0 API tests: health, projects, game bible, jobs."""

from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "weld-api"
    assert body["environment"] == "test"


def test_list_projects_contains_seeded_sample(client: TestClient) -> None:
    r = client.get("/api/v1/projects")
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) == 1
    p = projects[0]
    assert p["slug"] == "scrap-sprint"
    assert p["title"] == "Scrap Sprint"
    assert p["provenance"] == "deterministic_sample"
    assert p["status"] == "verified"


def test_project_detail_includes_game_bible_and_jobs(client: TestClient) -> None:
    r = client.get("/api/v1/projects/scrap-sprint")
    assert r.status_code == 200
    p = r.json()
    assert p["game_bible"]["game"]["slug"] == "scrap-sprint"
    assert p["game_bible"]["win_condition"]["target"] == 5
    assert p["game_bible"]["level"]["timer_seconds"] == 90
    # Exactly one honest deterministic seed job, no fake AI jobs.
    assert len(p["jobs"]) == 1
    assert p["jobs"][0]["type"] == "deterministic_sample_build"
    assert p["jobs"][0]["status"] == "succeeded"


def test_gamebible_endpoint_matches_fixture_contract(client: TestClient) -> None:
    r = client.get("/api/v1/projects/scrap-sprint/gamebible")
    assert r.status_code == 200
    body = r.json()
    assert body["schema_version"] == 1
    assert body["data"]["quality_requirements"] == {
        "start_successfully": True,
        "restartable": True,
        "win_reachable": True,
        "lose_reachable": True,
        "zero_console_errors": True,
    }
    assert len(body["data"]["level"]["pickups"]) >= body["data"]["win_condition"]["target"]


def test_unknown_project_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/projects/does-not-exist").status_code == 404
    assert client.get("/api/v1/projects/does-not-exist/gamebible").status_code == 404
    assert client.get("/api/v1/projects/does-not-exist/jobs").status_code == 404
