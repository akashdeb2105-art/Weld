"""M1 Game Director tests — offline composer, validation, and the POST route.

These run hermetically: no LLM key is set in tests, so the Director exercises
its deterministic offline path. The LLM path is covered by the seam (provider
interface) and validated the same way.
"""

from fastapi.testclient import TestClient

from app.director import (
    DirectorError,
    compose_offline,
    infer_genre,
    slugify,
)
from app.gamebible import GameBibleDoc


def test_slugify_kebab_case() -> None:
    assert slugify("My Cool Game!") == "my-cool-game"
    assert slugify("  Spaces  ") == "spaces"
    assert slugify("!!!") == "untitled-game"


def test_infer_genre_defaults_and_keywords() -> None:
    assert infer_genre("a game where you jump between platforms") == "platformer"
    assert infer_genre("dodge the incoming bullets and survive") == "dodge_survival"
    assert infer_genre("collect scrap and deliver it") == "top_down_arcade"
    assert infer_genre("something vague") == "top_down_arcade"


def test_infer_genre_prefers_explicit_camera_phrase() -> None:
    # "top-down arcade" should beat the incidental "dodge" verb.
    assert infer_genre("A top-down arcade game where you collect mushrooms and dodge pools") == "top_down_arcade"


def test_offline_composer_title_and_genre() -> None:
    result = compose_offline("A top-down arcade game where you collect glowing mushrooms and dodge acid pools")
    doc = result.doc
    assert doc["game"]["genre"] == "top_down_arcade"
    # Title is a short derived phrase, not the raw 48-char prompt.
    assert len(doc["game"]["title"]) <= 40
    assert doc["game"]["title"].islower() is False
    assert doc["game"]["slug"]  # non-empty kebab slug


def test_offline_composer_produces_valid_bible() -> None:
    result = compose_offline("Collect glowing mushrooms and avoid acid pools")
    assert result.mode == "offline"
    # Must be a valid GameBible document.
    doc = GameBibleDoc.model_validate(result.doc)
    assert doc.game.genre in {"top_down_arcade", "platformer", "dodge_survival"}
    assert doc.provenance["origin"] == "ai_generated"
    assert "offline_mode" in result.notes
    assert "template_composed" in result.notes
    # Entity inference picked up the prompt's nouns.
    assert "mushrooms" in doc.core_loop[0]


def test_offline_composer_rejects_too_short_prompt() -> None:
    try:
        compose_offline("hi")
    except DirectorError as exc:
        assert "Describe your game" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected DirectorError")


def test_create_project_offline_happy_path(client: TestClient) -> None:
    r = client.post(
        "/api/v1/projects",
        json={"prompt": "Collect glowing mushrooms and avoid acid pools"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mode"] == "offline"
    assert body["project"]["provenance"] == "offline_draft"
    assert body["project"]["status"] == "draft"
    slug = body["project"]["slug"]
    assert slug

    # The new project is retrievable and carries the generated bible.
    detail = client.get(f"/api/v1/projects/{slug}")
    assert detail.status_code == 200
    d = detail.json()
    assert d["game_bible"]["game"]["slug"] == body["game_bible"]["game"]["slug"]
    # A real director job was recorded (not faked).
    assert any(j["type"] == "director_draft" and j["status"] == "succeeded" for j in d["jobs"])


def test_create_project_slug_uniqueness(client: TestClient) -> None:
    payload = {"prompt": "Collect glowing mushrooms and avoid acid pools"}
    a = client.post("/api/v1/projects", json=payload)
    b = client.post("/api/v1/projects", json=payload)
    assert a.status_code == 201 and b.status_code == 201
    sa, sb = a.json()["project"]["slug"], b.json()["project"]["slug"]
    assert sa != sb
    assert sb.startswith(sa.split("-")[0])


def test_create_project_rejects_short_prompt(client: TestClient) -> None:
    r = client.post("/api/v1/projects", json={"prompt": "hi"})
    # pydantic min_length on CreateProjectRequest -> 422
    assert r.status_code == 422
