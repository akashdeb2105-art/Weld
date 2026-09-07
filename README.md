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

## Status: M1–M6 — the full product loop is live

Describe a game and the **Game Director** drafts a validated **Game Bible**;
the **Builder** turns it into a playable game; the **Playtester** breaks it
with real, deterministic evidence; bugs become regression tests; and a
gate-guarded **Publish** ships it to a public gallery where anyone can play
and **remix** it. Everything visible is real; nothing is faked — when no LLM
key is set, the Director uses a clearly-labeled deterministic offline composer
instead of pretending to be a model.

| Milestone | What it is |
| --------- | ---------- |
| **M1 Game Director + Game Bible** | `backend/app/director.py` — prompt → schema-validated GameBible. LLM-backed (OpenAI-compatible, provider fallback) with an honest offline fallback. Review-before-create + Studio Bible editor. |
| **M2 Game Builder** | Deterministic build step + endpoint; every project is served as a playable game from its own Game Bible. |
| **M3 Real Playtester** | `@weld/playtester` — engine-free deterministic harness proving the quality gates one by one; "Break it" in the Studio. |
| **M4 Bug → Fix → Regression** | Bugs become regression tests. |
| **M5 Live Studio + Publish** | Gate-guarded publish (runs the real Playtester; nothing ships unless every gate passes) + public share page at `/play/<slug>`. |
| **M6 Community / Remix + QA** | Public gallery, remix into a private editable draft, social share cards, Versions/remix lineage, Visual QA + zero-console-errors + performance release gates, synthesized audio. |

### M0 foundation

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

The one blueprint item not yet built is a real **accounts / multi-user
Community** model (the blueprint names "Community" but specifies no auth, so
the shipped community surface is the shareable, remixable gallery). See the
[blueprint](WELD_AI_GAME_STUDIO_MASTER_BLUEPRINT.md).

### Game Director configuration

Set `LLM_API_KEY` (OpenAI-compatible) to enable the real LLM Director — see
`.env.example`. With no key, `POST /api/v1/projects` uses the deterministic
offline composer and labels the result `offline_draft`.

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
python -m venv backend/.venv && backend/.venv/Scripts/pip install -r backend/requirements-dev.txt  # (Unix: backend/.venv/bin/pip)
cp .env.example .env

# 1. database
docker compose up postgres

# 2. api (terminal A)
cd backend && ../.venv/Scripts/alembic upgrade head && ../.venv/Scripts/uvicorn app.main:app --reload

# 3. web (terminal B)
npm run build -w @weld/sample-game   # build the sample game once
npm run dev -w @weld/web             # http://localhost:3000
```

## Verify

```bash
npm run lint          # ESLint
npm run typecheck     # TS strict, all workspaces
npm test              # Vitest: schema + game logic + web
cd backend && python -m pytest   # API: health, projects, migrations
npm run build         # production builds
npm run e2e           # Playwright smoke (boots API+web, plays the game)
```

## Repository layout

```text
frontend/         Next.js — public site + Studio (everything the user sees)
backend/          FastAPI — projects, GameBibles, jobs, the Game Director
packages/
  gamebible/      GameBible schema + canonical fixture (shared contract)
  engine/         Shared pure game engine (the runtime every game runs on)
  playtester/     Deterministic harness that proves the quality gates
  sample-game/    Scrap Sprint — deterministic Phaser 3 game
docs/             architecture, local dev, gamebible spec
e2e/              Playwright tests (smoke, director, publish)
docker-compose.yml
```

The two runnable services live at the top level by name: `frontend/` is the
Next.js app, `backend/` is the Python API. Shared libraries stay under
`packages/` so the front and back ends never reach into each other.

## The product loop

WELD's differentiation isn't generation — that's a commodity. It's the loop:
**build → playtest → bug → fix → regression → release gate.** The deterministic
sample game in M0 is the exact artifact that loop will inspect, so the whole
pipeline is exercised honestly before any model writes a line.

See [docs/architecture.md](docs/architecture.md) for how the pieces fit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
History: [CHANGELOG.md](CHANGELOG.md).
