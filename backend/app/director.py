"""Game Director (M1) — turn a plain-language prompt into a Game Bible.

The Director is the first AI role in the crew. It converts a free-form game
description into a *valid* GameBible document (the M0 schema contract), which
the rest of the pipeline then builds, plays, and tests.

Honesty rules baked in (blueprint):
  * Every produced document is validated against the GameBible contract before
    it is returned — the Director never emits an invalid spec.
  * When no LLM key is configured, a deterministic offline interpreter composes
    a playable spec from the prompt's real signals (genre, controls, theme).
    The result is *honestly labeled* as offline + template_composed so the UI
    can say exactly how it was made — never "AI-generated" when it wasn't.

Only the `platformer`, `top_down_arcade` and `dodge_survival` genres are
supported in M1, because the deterministic runtime can only execute the
collect/deliver/dodge verbs. Prompts for anything else are rejected with a
clear, actionable error instead of a broken game.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from .config import settings
from .gamebible import GameBibleDoc

logger = logging.getLogger("weld.director")

# Genres the M1 runtime can actually execute. Mirrors the GameBible enum but is
# deliberately narrower — do not promise what we cannot build yet.
SUPPORTED_GENRES = {"top_down_arcade", "platformer", "dodge_survival"}

DEFAULT_PALETTE = ["#0B0D12", "#1B2130", "#FF5C1A", "#8FD3FF", "#F2F0EA"]

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    slug = _SLUG_RE.sub("-", text.lower()).strip("-")
    return slug[:80] or "untitled-game"


# Self-contained set of words that should never lead a title. (Defined here,
# before the theme-extraction constants, to avoid a forward reference.)
_TITLE_STOPWORDS = {
    "a", "an", "the", "game", "player", "you", "your", "with", "and", "or",
    "that", "this", "where", "while", "before", "after", "into", "from",
    "top", "down", "top-down", "arcade", "platformer", "dodge", "survive",
    "sidescroll", "side", "view",
}


def _title_from(prompt: str, collectible: str) -> str:
    """Derive a short, readable title from the prompt's most vivid words.

    Prefers the collectible/hazard nouns; falls back to the first meaningful
    content words. Keeps it to 2–4 words.
    """
    words = [
        w
        for w in re.findall(r"[a-zA-Z]{3,}", prompt.lower())
        if w not in _TITLE_STOPWORDS and w not in _ADJECTIVES
    ]
    if collectible and collectible not in _TITLE_STOPWORDS:
        first = collectible
        second = next((w for w in words if w != first), None)
        title = f"{first} {second}" if second else f"{first} run"
    elif words:
        title = " ".join(words[:3])
    else:
        title = "untitled run"
    return " ".join(title.split()).title()[:40]


# ---------------------------------------------------------------------------
# Offline intent extraction
# ---------------------------------------------------------------------------

_GENRE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    # More specific genres first so an explicit phrase wins over a stray verb.
    ("platformer", ("platformer", "platform", "jump", "side view", "side-scroll", "run and jump")),
    ("top_down_arcade", ("top-down", "top down", "arcade", "collect", "fetch", "courier", "deliver", "gather")),
    ("dodge_survival", ("dodge", "survive", "avoid", "bullet hell", "endless")),
]

# An explicit "top-down"/"side view" phrase should outrank an incidental verb.
_CAMERA_HINTS = {
    "top-down": "top_down_arcade",
    "top down": "top_down_arcade",
    "side view": "platformer",
    "side-scroll": "platformer",
    "sidescroll": "platformer",
}


def infer_genre(prompt: str) -> str:
    p = prompt.lower()
    for hint, genre in _CAMERA_HINTS.items():
        if hint in p:
            return genre
    for genre, keywords in _GENRE_KEYWORDS:
        if any(k in p for k in keywords):
            return genre
    # Default to the genre the sample game proves out.
    return "top_down_arcade"


_ENTITY_STOPWORDS = {
    "a", "an", "the", "game", "player", "you", "your", "with", "and", "or",
    "that", "this", "where", "while", "before", "after", "into", "from",
}

# Common adjectives/determiners we should never pick as a collectible/hazard.
_ADJECTIVES = {
    "glowing", "acid", "acidic", "spiky", "fiery", "frozen", "dark", "bright",
    "golden", "silver", "tiny", "giant", "fast", "slow", "deadly", "magic",
    "magical", "cursed", "ancient", "neon", "electric", "toxic", "sharp",
}

# Verb keywords that introduce the collectible vs. the hazard in a prompt.
_COLLECT_VERBS = ("collect", "gather", "grab", "pick", "fetch", "deliver", "haul", "rescue")
_HAZARD_VERBS = ("avoid", "dodge", "evade", "escape", "outrun", "survive")


def _first_noun_after(words: list[str], verbs: tuple[str, ...]) -> str | None:
    """Return the first plausible noun following any of the given verbs."""
    for i, w in enumerate(words):
        if any(w.startswith(v) or v.startswith(w) for v in verbs):
            for cand in words[i + 1:]:
                if cand in _ENTITY_STOPWORDS or cand in _ADJECTIVES:
                    continue
                return cand
    return None


def _extract_theme(prompt: str) -> tuple[str, str]:
    """Return (collectible, hazard) theme nouns guessed from the prompt."""
    words = re.findall(r"[a-zA-Z]{3,}", prompt.lower())
    collectible = _first_noun_after(words, _COLLECT_VERBS)
    hazard = _first_noun_after(words, _HAZARD_VERBS)
    if collectible is None:
        themed = [w for w in words if w not in _ENTITY_STOPWORDS and w not in _ADJECTIVES]
        collectible = themed[0] if themed else "scrap"
    if hazard is None or hazard == collectible:
        themed = [
            w
            for w in words
            if w not in _ENTITY_STOPWORDS and w not in _ADJECTIVES and w != collectible
        ]
        hazard = themed[0] if themed else "hazard"
    return collectible, hazard


# ---------------------------------------------------------------------------
# Result + errors
# ---------------------------------------------------------------------------


class DirectorError(Exception):
    """Raised for actionable, user-facing Director failures (400-level)."""


class DirectorUnavailableError(DirectorError):
    """LLM configured but unreachable / failed."""


@dataclass
class DirectorResult:
    doc: dict[str, Any]
    mode: str  # "llm" | "offline"
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Offline composer
# ---------------------------------------------------------------------------


def compose_offline(prompt: str) -> DirectorResult:
    """Deterministically compose a playable GameBible from prompt signals.

    Produces a real, schema-valid document using the collect/deliver verbs the
    runtime can execute. Clearly labeled as offline + template_composed.
    """
    text = prompt.strip()
    if len(text) < 8:
        raise DirectorError("Describe your game in a sentence or two (at least 8 characters).")

    genre = infer_genre(text)
    if genre not in SUPPORTED_GENRES:
        raise DirectorError(
            f"M1 can't build a '{genre}' game yet. Supported genres: "
            + ", ".join(sorted(SUPPORTED_GENRES))
            + "."
        )

    collectible, hazard = _extract_theme(text)
    title = _title_from(text, collectible)
    slug = slugify(title)

    doc: dict[str, Any] = {
        "schemaVersion": 1,
        "game": {
            "title": title,
            "slug": slug,
            "genre": genre,
            "target": "browser_desktop",
            "camera": "top_down" if genre != "platformer" else "side_view",
            "one_liner": text[:160],
        },
        "player": {
            "role": f"{collectible} runner",
            "movement": "keyboard_8_direction",
            "health": 3,
        },
        "core_loop": [
            f"spot_{collectible}",
            f"collect_{collectible}",
            f"avoid_{hazard}",
            "deliver_to_goal",
            "earn_score",
            "beat_the_timer",
        ],
        "win_condition": {
            "type": "deliver_count",
            "target": 5,
            "description": f"Deliver 5 {collectible} to the goal before the timer runs out.",
        },
        "lose_conditions": ["timer_zero", "health_zero"],
        "controls": {
            "up": ["W", "ArrowUp"],
            "down": ["S", "ArrowDown"],
            "left": ["A", "ArrowLeft"],
            "right": ["D", "ArrowRight"],
            "interact": ["E", "Space"],
            "pause": ["Escape", "P"],
            "restart": ["R"],
        },
        "systems": [
            "movement",
            "collisions",
            "hazards",
            "scoring",
            "timer",
            "pickups",
            "delivery",
            "restart",
            "pause",
        ],
        "visual_direction": {
            "theme": f"{collectible}_and_{hazard}",
            "palette": DEFAULT_PALETTE,
            "notes": "Composed by the offline Director; refine in the Studio.",
        },
        "audio": {"enabled": False, "style": "none"},
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
            "pickups": [
                {"id": f"{collectible}-0{i}", "kind": "scrap", "x": x, "y": y}
                for i, (x, y) in enumerate(
                    [(132, 140), (828, 140), (132, 430), (828, 430), (480, 160), (220, 300), (740, 300), (480, 470)],
                    start=1,
                )
            ],
            "hazards": [
                {"id": f"{hazard}-0{i}", "kind": "spark_pit", "x": x, "y": y, "radius": 30}
                for i, (x, y) in enumerate([(300, 215), (660, 215), (480, 395)], start=1)
            ],
        },
        "provenance": {
            "origin": "ai_generated",
            "notes": "Composed by the offline deterministic Director (no LLM configured). "
            "Genre, collectible and hazard inferred from the prompt.",
        },
    }
    # Validate with the Python mirror, but persist the full authored document:
    # the mirror is a subset and model_dump() would drop fields the runtime and
    # playtester need (e.g. level.delivery_zone.label).
    GameBibleDoc.model_validate(doc)
    validated = doc
    notes = [
        "offline_mode",
        "template_composed",
        f"genre_inferred:{genre}",
        f"collectible:{collectible}",
        f"hazard:{hazard}",
    ]
    return DirectorResult(doc=validated, mode="offline", notes=notes)


# ---------------------------------------------------------------------------
# LLM composer (OpenAI-compatible)
# ---------------------------------------------------------------------------

_JSON_SHAPE = """{
  "schemaVersion": 1,
  "game": {"title": "...", "slug": "kebab-case", "genre": "top_down_arcade",
    "target": "browser_desktop", "camera": "top_down", "one_liner": "..."},
  "player": {"role": "...", "movement": "keyboard_8_direction", "health": 3},
  "core_loop": ["spot_x", "collect_x", "avoid_y", "deliver_to_goal", "earn_score", "beat_the_timer"],
  "win_condition": {"type": "deliver_count", "target": 5, "description": "..."},
  "lose_conditions": ["timer_zero", "health_zero"],
  "controls": {"up": ["W", "ArrowUp"], "down": ["S", "ArrowDown"],
    "left": ["A", "ArrowLeft"], "right": ["D", "ArrowRight"],
    "interact": ["E", "Space"], "pause": ["Escape", "P"], "restart": ["R"]},
  "systems": ["movement", "collisions", "hazards", "scoring", "timer",
    "pickups", "delivery", "restart", "pause"],
  "visual_direction": {"theme": "...", "palette": ["#0B0D12", "#1B2130", "#FF5C1A", "#8FD3FF", "#F2F0EA"], "notes": "..."},
  "audio": {"enabled": false, "style": "none"},
  "quality_requirements": {"start_successfully": true, "restartable": true,
    "win_reachable": true, "lose_reachable": true, "zero_console_errors": true},
  "level": {"name": "...", "width": 960, "height": 540, "timer_seconds": 90,
    "player_spawn": {"x": 480, "y": 300}, "player_speed": 220,
    "delivery_zone": {"x": 408, "y": 24, "width": 144, "height": 60, "label": "GOAL"},
    "pickups": [{"id": "scrap-01", "kind": "scrap", "x": 132, "y": 140}],
    "hazards": [{"id": "pit-01", "kind": "spark_pit", "x": 300, "y": 215, "radius": 30}]},
  "provenance": {"origin": "ai_generated", "notes": "..."}
}"""

_SYSTEM_PROMPT = (
    "You are the WELD Game Director. Turn the user's game idea into a single "
    "JSON object conforming to the GameBible v1 schema. Respond with ONLY the "
    "JSON object \u2014 no markdown, no code fences, no prose, no comments.\n\n"
    "Hard rules:\n"
    f"- genre must be exactly one of {sorted(SUPPORTED_GENRES)}.\n"
    "- schemaVersion must be the integer 1; game.target must be 'browser_desktop'.\n"
    "- game.camera must be 'top_down' (or 'side_view' for a platformer).\n"
    "- Every pickup needs a unique string 'id', kind 'scrap', and integer x,y.\n"
    "- Every hazard needs a unique string 'id', kind 'spark_pit', integer x,y, and a 'radius' number.\n"
    "- Provide at least 5 pickups and at least 2 hazards.\n"
    "- win_condition must be an OBJECT with keys type, target, description (never a string).\n"
    "- lose_conditions must be an array of strings; controls values are arrays of key strings.\n"
    "- quality_requirements fields must all be boolean true.\n"
    "- Derive title, collectible and hazard nouns from the user's prompt; keep coordinates within width/height.\n\n"
    "Return JSON in EXACTLY this shape (fill in real values):\n"
    f"{_JSON_SHAPE}"
)


class _InvalidModelOutput(Exception):
    """The model returned JSON that does not satisfy the GameBible schema.

    Retryable — we try the next provider/model rather than failing the user.
    """


def _validate_doc(raw: dict, source: str) -> dict:
    """Validate a model-produced document against the real GameBible contract.

    Never trust the model blindly. A structural mismatch is retryable (try the
    next provider); an unsupported genre is a genuine user-facing error.
    """
    try:
        GameBibleDoc.model_validate(raw)
    except Exception as exc:
        raise _InvalidModelOutput(f"{source} produced an invalid Game Bible: {exc}") from exc
    genre = raw.get("game", {}).get("genre")
    if genre not in SUPPORTED_GENRES:
        raise DirectorError(
            f"The Director proposed an unsupported genre '{genre}'. "
            f"M1 supports: {', '.join(sorted(SUPPORTED_GENRES))}."
        )
    # Keep the FULL document, not a model_dump() of the Python mirror — the
    # mirror is a subset and would silently drop fields the runtime/playtester
    # need (e.g. level.delivery_zone.label), producing a bible that fails the
    # strict contract. Validate with the mirror, persist the whole thing.
    raw.setdefault("provenance", {})["origin"] = "ai_generated"
    return raw


async def _call_openai_compatible(prompt: str, *, api_key: str, base_url: str, model: str) -> dict:
    """Call an OpenAI-compatible chat endpoint (Fireworks, OpenRouter, custom)."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    url = f"{base_url.rstrip('/')}/chat/completions"
    async with httpx.AsyncClient(timeout=settings.director_timeout_seconds) as client:
        resp = await client.post(url, json=payload, headers=headers)
    if resp.status_code != 200:
        raise DirectorUnavailableError(f"{model} returned {resp.status_code}: {resp.text[:200]}")
    try:
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raise DirectorUnavailableError(f"{model} returned malformed JSON.") from exc


async def _call_gemini(prompt: str, *, api_key: str, model: str) -> dict:
    """Call Google AI Studio's generateContent endpoint (different API shape)."""
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=settings.director_timeout_seconds) as client:
        resp = await client.post(url, json=payload)
    if resp.status_code != 200:
        raise DirectorUnavailableError(f"{model} returned {resp.status_code}: {resp.text[:200]}")
    try:
        parts = resp.json()["candidates"][0]["content"]["parts"]
        content = "".join(p.get("text", "") for p in parts)
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raise DirectorUnavailableError(f"{model} returned malformed JSON.") from exc


async def _compose_llm(prompt: str) -> DirectorResult:
    """Try each configured provider in order; use the first that yields a valid bible."""
    providers = settings.director_providers()
    if not providers:
        return compose_offline(prompt)

    # Build the ordered list of (provider, model) attempts. Fireworks also gets
    # a second attempt on its fallback model (e.g. Kimi K3) before moving on.
    attempts: list[tuple[dict, str]] = []
    for provider in providers:
        attempts.append((provider, provider["model"]))
        if provider["name"] == "fireworks" and settings.fireworks_model_fallback.strip():
            attempts.append((provider, settings.fireworks_model_fallback.strip()))

    last_error: Exception | None = None
    for provider, model in attempts:
        try:
            if provider["kind"] == "gemini":
                raw = await _call_gemini(prompt, api_key=provider["api_key"], model=model)
            else:
                raw = await _call_openai_compatible(
                    prompt,
                    api_key=provider["api_key"],
                    base_url=provider["base_url"],
                    model=model,
                )
            doc = _validate_doc(raw, f"{provider['name']} model {model}")
            return DirectorResult(
                doc=doc,
                mode="llm",
                notes=["llm_drafted", f"provider:{provider['name']}", f"model:{model}"],
            )
        except _InvalidModelOutput as exc:
            logger.warning("Director provider %s (%s) gave invalid spec: %s", provider["name"], model, str(exc)[:200])
            last_error = exc
            continue
        except DirectorUnavailableError as exc:
            logger.warning("Director provider %s (%s) failed: %s", provider["name"], model, exc)
            last_error = exc
            continue
        except httpx.HTTPError as exc:
            logger.warning("Director provider %s (%s) unreachable: %s", provider["name"], model, exc)
            last_error = exc
            continue

    # Every provider/model was unreachable — degrade honestly to the offline
    # composer rather than failing the request, and say why.
    logger.warning("All Director providers unavailable (%s); using offline composer.", last_error)
    offline = compose_offline(prompt)
    offline.notes = ["llm_unavailable_fell_back"] + offline.notes
    return offline


async def generate_game_bible(prompt: str) -> DirectorResult:
    """Produce a validated GameBible for a prompt.

    Uses the configured LLM providers when any key is present; otherwise falls
    back to the deterministic offline composer so the feature always works and
    never fakes output.
    """
    text = prompt.strip()
    if len(text) < 8:
        raise DirectorError("Describe your game in a sentence or two (at least 8 characters).")
    return await _compose_llm(text)
