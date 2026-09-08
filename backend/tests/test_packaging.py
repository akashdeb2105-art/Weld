"""Regression: every third-party module the app imports at runtime must be a
declared *runtime* dependency — not a dev/test-only one, and not missing.

The API crashed on `docker compose up` because director.py imports `httpx` at
module load while httpx was only listed under [project.optional-dependencies].dev
and the Docker image installed a hand-copied dep list that omitted it.
"""

from __future__ import annotations

import ast
import sys
import tomllib
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

# import name -> distribution/requirement token it is satisfied by
THIRD_PARTY_TO_REQ = {
    "fastapi": "fastapi",
    "httpx": "httpx",
    "pydantic": "pydantic",
    "pydantic_settings": "pydantic-settings",
    "sqlalchemy": "sqlalchemy",
    "uvicorn": "uvicorn",
    "alembic": "alembic",
    "psycopg": "psycopg",
}


def _top_level_imports(root: Path) -> set[str]:
    names: set[str] = set()
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    names.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names.add(node.module.split(".")[0])
    return names


def _runtime_requirement_tokens() -> set[str]:
    text = (BACKEND / "requirements.txt").read_text(encoding="utf-8")
    tokens: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-r"):
            continue
        name = line.split(";")[0].split("[")[0]
        for sep in (">=", "==", "<=", "~=", ">", "<", "!="):
            name = name.split(sep)[0]
        tokens.add(name.strip().lower())
    return tokens


def test_all_third_party_imports_are_runtime_deps() -> None:
    imported = _top_level_imports(APP)
    stdlib = set(sys.stdlib_module_names)
    third_party = {n for n in imported if n not in stdlib and n != "app"}

    unknown = third_party - THIRD_PARTY_TO_REQ.keys()
    assert not unknown, (
        f"new third-party import(s) {sorted(unknown)} — add them to "
        "requirements.txt and to THIRD_PARTY_TO_REQ in this test"
    )

    runtime = _runtime_requirement_tokens()
    missing = {
        mod: THIRD_PARTY_TO_REQ[mod]
        for mod in third_party
        if THIRD_PARTY_TO_REQ[mod].lower() not in runtime
    }
    assert not missing, f"imported at runtime but not in requirements.txt: {missing}"


def test_pyproject_runtime_deps_match_requirements_txt() -> None:
    pyproject = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))
    proj_deps = {
        d.split(";")[0].split("[")[0].split(">=")[0].split("==")[0].strip().lower()
        for d in pyproject["project"]["dependencies"]
    }
    runtime = _runtime_requirement_tokens()
    assert proj_deps == runtime, (
        "pyproject.toml [project.dependencies] and backend/requirements.txt have "
        f"drifted: only in pyproject={proj_deps - runtime}, "
        f"only in requirements.txt={runtime - proj_deps}"
    )


def test_httpx_is_not_dev_only() -> None:
    pyproject = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))
    dev = pyproject["project"].get("optional-dependencies", {}).get("dev", [])
    dev_names = {d.split(">=")[0].split("==")[0].strip().lower() for d in dev}
    assert "httpx" not in dev_names, "httpx is a runtime dep; it must not be dev-only"
