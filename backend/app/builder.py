"""Game Builder (M2)  compile a validated Game Bible into a build manifest.

Honesty rules (blueprint): "compilation is not completion" and "never fake AI
progress". So a *build* here is a real, deterministic compilation step with a
concrete artifact (the manifest) and a recorded Job  not a label we slap on a
persisted row.

What the Builder actually does today:
  * validates the bible against the strict playtester contract (the "builds"
    gate is evidence, not vibes),
  * derives the exact runtime contract the generic Phaser bundle will run:
    which win condition is armed, which lose conditions, which controls are
    bound, the entry counts and palette it will draw,
  * emits a content-addressed manifest (sha256 of the canonical bible) so a
    build is reproducible and a rebuild after an edit is detectable.

Determinism: no wall-clock, no randomness. The same bible always compiles to
the same manifest (modulo the build timestamp the caller stamps on the Job).
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from . import playtest

# The generic runtime every project compiles to in M2 (one runtime, many
# bibles). Bumped when the runtime's contract changes so stale builds are
# detectable. Honest: this is the real bundle the game boots from.
RUNTIME_ID = "weld-runtime"
RUNTIME_VERSION = "1.0.0"


class BuildError(RuntimeError):
    """The bible could not be compiled (schema/contract failure)."""


class BuildUnavailableError(RuntimeError):
    """The builder can't run here (e.g. the playtester's Node CLI is missing)."""


def _content_hash(doc: dict[str, Any]) -> str:
    """Stable sha256 over the canonical bible (sorted keys, tight separators)."""
    blob = json.dumps(doc, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def _armed_controls(doc: dict[str, Any]) -> dict[str, list[str]]:
    """The control bindings the runtime will honor, straight from the bible."""
    c = doc.get("controls", {})
    out: dict[str, list[str]] = {
        "up": list(c.get("up", [])),
        "down": list(c.get("down", [])),
        "left": list(c.get("left", [])),
        "right": list(c.get("right", [])),
        "pause": list(c.get("pause", [])),
    }
    if c.get("interact"):
        out["interact"] = list(c["interact"])
    if c.get("restart"):
        out["restart"] = list(c["restart"])
    return out


def build_manifest(doc: dict[str, Any]) -> dict[str, Any]:
    """Compile a Game Bible into a build manifest.

    Raises BuildUnavailableError if the strict contract checker can't run, and
    BuildError if the bible fails it. Returns a JSON-serializable manifest.
    """
    # "Builds" is proven by the strict playtester contract, not assumed.
    try:
        report = playtest.playtest_bible(doc)
    except playtest.PlaytestUnavailableError as exc:
        raise BuildUnavailableError(str(exc)) from exc
    except playtest.PlaytestError as exc:
        raise BuildError(str(exc)) from exc

    builds_gate = next((g for g in report.get("gates", []) if g.get("gate") == "builds"), None)
    if builds_gate is not None and not builds_gate.get("pass", False):
        raise BuildError(f"bible fails the builds gate: {builds_gate.get('evidence', '')}")

    game = doc.get("game", {})
    level = doc.get("level", {})
    win = doc.get("win_condition", {})
    digest = _content_hash(doc)

    return {
        "artifact_id": f"{game.get('slug', 'game')}@{digest[:12]}",
        "content_hash": digest,
        "runtime": {"id": RUNTIME_ID, "version": RUNTIME_VERSION},
        "schema_version": doc.get("schemaVersion", 1),
        "slug": game.get("slug"),
        "title": game.get("title"),
        "genre": game.get("genre"),
        "armed": {
            "win_condition": {"type": win.get("type"), "target": win.get("target")},
            "lose_conditions": list(doc.get("lose_conditions", [])),
            "controls": _armed_controls(doc),
        },
        "level": {
            "name": level.get("name"),
            "size": {"width": level.get("width"), "height": level.get("height")},
            "timer_seconds": level.get("timer_seconds"),
            "player_speed": level.get("player_speed"),
            "pickups": len(level.get("pickups", [])),
            "hazards": len(level.get("hazards", [])),
        },
        "palette": doc.get("visual_direction", {}).get("palette", []),
        # The strict-contract verdict that justifies "builds".
        "evidence": builds_gate.get("evidence", "") if builds_gate else "",
    }
