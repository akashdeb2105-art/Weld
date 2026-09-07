"""Playtest bridge (M3) — run the deterministic TS playtester from Python.

The Playtester (@weld/playtester) is TypeScript, so the API can't import it.
Instead we shell out to its self-contained bundled CLI
(packages/playtester/dist/cli.cjs) with plain `node`, passing the project's
GameBible as a temp JSON file. The CLI prints the evidence-backed report as
JSON on stdout; exit code 0 = all gates passed, 1 = a gate failed, 2 = usage
or parse error.

Honesty rule: if Node or the built CLI isn't available, we say so plainly
(503 with a clear reason) rather than fabricate a verdict.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger("weld.playtest")

# Repo root = backend/app/playtest.py -> parents[2] is the workspace root.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_CLI = _REPO_ROOT / "packages" / "playtester" / "dist" / "cli.cjs"

_TIMEOUT_SECONDS = 60


class PlaytestUnavailableError(RuntimeError):
    """Raised when the playtester can't run here (no Node, CLI not built)."""


class PlaytestError(RuntimeError):
    """Raised when the playtester ran but its output couldn't be understood."""


def _ensure_runnable() -> str:
    """Return the node binary to use, or raise PlaytestUnavailableError."""
    node = shutil.which("node")
    if node is None:
        raise PlaytestUnavailableError(
            "Node.js is not on PATH, so the playtester can't run in this environment"
        )
    if not _CLI.is_file():
        raise PlaytestUnavailableError(
            "Playtester CLI is not built (packages/playtester/dist/cli.cjs missing). "
            "Run `npm run build -w @weld/playtester` first."
        )
    return node


def playtest_bible(bible: dict[str, Any]) -> dict[str, Any]:
    """Run the playtester against a GameBible document and return its report.

    Returns the parsed PlaytestReport dict:
        { slug, pass, gates: [{gate, pass, evidence, detail?}], simulatedSeconds }
    """
    node = _ensure_runnable()

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", prefix="weld-bible-", delete=False, encoding="utf-8"
    ) as tmp:
        json.dump(bible, tmp)
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            [node, str(_CLI), tmp_path],
            capture_output=True,
            text=True,
            timeout=_TIMEOUT_SECONDS,
            cwd=_REPO_ROOT,
        )
    except subprocess.TimeoutExpired as exc:
        raise PlaytestUnavailableError(
            f"playtester timed out after {_TIMEOUT_SECONDS}s"
        ) from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    # Exit 0 (all pass) and 1 (a gate failed) both carry a valid report.
    if proc.returncode in (0, 1) and proc.stdout.strip():
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise PlaytestError(f"playtester emitted non-JSON output: {exc}") from exc

    detail = (proc.stderr or proc.stdout or "unknown error").strip()
    raise PlaytestError(f"playtester failed (exit {proc.returncode}): {detail[:400]}")
