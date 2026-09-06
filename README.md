# WELD

### Describe it. Build it. Break it. Ship it.

WELD is an AI game studio for browser games. Describe a game — WELD builds it,
**then actually plays it**, finds what breaks, fixes it, and ships something that
survived its own playtest.

```text
Prompt → Game Bible → Build → Play → Test → Bug → Fix → Regression → Publish
```

> **Generated code isn't the product. A tested game is.**
> WELD never claims a game is "bug-free" — it proves games against explicit,
> evidence-backed quality gates.

---

## Status: M0 — foundation

This milestone establishes the real product surface and the first playable,
honest experience. Everything visible is real; nothing is faked.

| Piece | What it is |
| ----- | ---------- |
| **Public website** | Premium landing page (`/`) with the playhead motif and a **real playable game** embedded |
| **Web app shell** | Projects (`/app`) + Studio (`/app/studio/scrap-sprint`) |
| **Design system** | "Blueprint & Spark" tokens: type, color, semantic states, motion, reduced-motion support |
| **GameBible schema** | Versioned Zod contract + canonical fixture — the shared source of truth |
| **Sample game** | **Scrap Sprint** (Phaser 3 + TS): deterministic, fully playable, pure tested logic core, read-only `window.__WELD__` bridge |
| **API** | FastAPI: `/health`, `/api/v1/projects[/…]` with Pydantic schemas |
| **Database** | PostgreSQL + Alembic migrations (SQLite for hermetic tests) |
| **Local dev** | Docker Compose: web + api + postgres |

Not here yet (by design): the AI Director/Builder/Playtester, real event
streaming, publish, accounts. The deterministic sample stands in — clearly
labeled — until the real engine lands in M1+. See the
[blueprint](WELD_AI_GAME_STUDIO_MASTER_BLUEPRINT.md).

## Quickstart

### Docker (everything, one command)

```bash
docker compose up --build
# → web:  http://localhost:3000
# → api:  http://localhost:8000/health
```

### Bare metal (two terminals)

Prereqs: Node 20+, Python 3.12+, Postgres (or use compose just for the DB).

```bash
# 0. one-time
npm install
python -m venv apps/api/.venv && apps/api/.venv/Scripts/pip install -r apps/api/requirements-dev.txt  # (Unix: apps/api/.venv/bin/pip)
cp .env.example .env

# 1. database
docker compose up postgres

# 2. api (terminal A)
cd apps/api && ../.venv/Scripts/alembic upgrade head && ../.venv/Scripts/uvicorn app.main:app --reload

# 3. web (terminal B)
npm run build -w @weld/sample-game   # build the sample game once
npm run dev -w @weld/web             # http://localhost:3000
```

## Verify

```bash
npm run lint          # ESLint
npm run typecheck     # TS strict, all workspaces
npm test              # Vitest: schema + game logic + web
cd apps/api && python -m pytest   # API: health, projects, migrations
npm run build         # production builds
npm run e2e           # Playwright smoke (boots API+web, plays the game)
```

## Repository layout

```text
apps/
  web/            Next.js — public site + Studio
  api/            FastAPI — projects, GameBibles, jobs
packages/
  gamebible/      GameBible schema + canonical fixture
  sample-game/    Scrap Sprint — deterministic Phaser 3 game
docs/             architecture, local dev, gamebible spec
e2e/              Playwright smoke tests
docker-compose.yml
```

## The product loop

WELD's differentiation isn't generation — that's a commodity. It's the loop:
**build → playtest → bug → fix → regression → release gate.** The deterministic
sample game in M0 is the exact artifact that loop will inspect, so the whole
pipeline is exercised honestly before any model writes a line.

See [docs/architecture.md](docs/architecture.md) for how the pieces fit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
History: [CHANGELOG.md](CHANGELOG.md).
