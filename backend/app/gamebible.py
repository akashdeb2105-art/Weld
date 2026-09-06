"""Load and validate the canonical GameBible fixture shipped with the repo.

The fixture lives in packages/gamebible/src/ and is the single source of truth
for the deterministic sample project (mirrored in TS as the typed `sampleBible`
export). The API validates it at startup with its own Pydantic mirror of the
contract (kept deliberately small), so a broken fixture fails fast instead of
serving bad data.
"""

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, field_validator

# gamebible.py -> app -> backend -> <repo root>  (parents[2])
FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "packages"
    / "gamebible"
    / "src"
    / "scrap-sprint.gamebible.json"
)


class Point(BaseModel):
    x: float
    y: float


class Rect(Point):
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class Pickup(Point):
    id: str
    kind: str


class Hazard(Point):
    id: str
    kind: str
    radius: float = Field(gt=0)


class Level(BaseModel):
    name: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    timer_seconds: int = Field(gt=0)
    player_spawn: Point
    player_speed: float = Field(gt=0)
    delivery_zone: Rect
    pickups: list[Pickup]
    hazards: list[Hazard]


class WinCondition(BaseModel):
    type: str
    target: int = Field(gt=0)
    description: str


class Game(BaseModel):
    title: str
    slug: str
    genre: str
    target: str
    camera: str
    one_liner: str


class GameBibleDoc(BaseModel):
    """Mirror of packages/gamebible/src/index.ts (wire-compatible subset)."""

    schemaVersion: int
    game: Game
    player: dict
    core_loop: list[str]
    win_condition: WinCondition
    lose_conditions: list[str]
    controls: dict
    systems: list[str]
    visual_direction: dict
    audio: dict
    quality_requirements: dict
    level: Level
    provenance: dict

    @field_validator("schemaVersion")
    @classmethod
    def _v1(cls, v: int) -> int:
        if v != 1:
            raise ValueError("unsupported schemaVersion")
        return v


def load_sample_game_bible(path: Path | None = None) -> dict[str, Any]:
    p = path or FIXTURE_PATH
    raw = json.loads(p.read_text(encoding="utf-8"))
    return GameBibleDoc.model_validate(raw).model_dump()
