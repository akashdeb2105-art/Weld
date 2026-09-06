# WELD Architecture

Modular monorepo. One deployable web app, one API, shared schema packages.
Nothing distributed until measurements justify it.

## High level

```text
                ┌────────────────────────────────────────────┐
  Browser  ───► │  apps/web  (Next.js)                       │
                │   /          public landing (real embed)   │
                │   /app       projects                      │
                │   /app/studio/[slug]  Studio               │
                └───────────────┬────────────────────────────┘
                                │ server-side fetch (no client-exposed internal URLs)
                ┌───────────────▼────────────────────────────┐
                │  apps/api  (FastAPI)                       │
                │   /health                                  │
                │   /api/v1/projects[/:slug[/gamebible|jobs]]│
                └───────────────┬────────────────────────────┘
                                │ SQLAlchemy
                       ┌────────▼────────┐
                       │  PostgreSQL     │
                       └─────────────────┘

  packages/gamebible   GameBible schema + fixture (shared source of truth)
  packages/sample-game Scrap Sprint (Phaser 3), driven by the fixture
```

## Boundaries (blueprint §107)

| Boundary   | Where | Rule |
| ---------- | ----- | ---- |
| schema     | `packages/gamebible` | Single contract; versioned; strict |
| artifacts  | fixture + DB JSON | Structured, inspectable, resumable |
| game       | `packages/sample-game` | Ordinary editable source, engine-agnostic logic core |
| runtime    | web sandboxed iframe | Untrusted code never runs in the API process |
| api        | `apps/api` | Thin HTTP over Pydantic schemas |

## The GameBible as the spine

Every project starts from a GameBible. In M0 the sample game *is built from*
its GameBible fixture (`packages/gamebible/samples/scrap-sprint.gamebible.json`):
the Phaser scene reads level bounds, spawns, timer, controls, and win target
from it. The API validates and serves the same fixture. The Studio renders it.
One artifact, four consumers — that's the pattern the AI crew inherits in M1+.

## The sample game's logic/render split

`packages/sample-game/src/game/logic.ts` is a pure, deterministic simulation
(no Phaser, no wall-clock, no RNG). Phaser (`scenes/GameScene.ts`) only renders
state and feeds intents. Consequences:

- Unit tests run in Node in milliseconds.
- The future Playtester asserts on real numeric state via `window.__WELD__`.
- A different renderer could replace Phaser without touching the rules.

## Honest states, no fake streams

There is deliberately **no SSE/event stream in M0** — there is no engine to
stream from. The Studio's playhead tracks the *real* game status via the
game's postMessage bridge. Event streaming lands with the engine (M5).

## Deployment

- **Frontend/public site:** Netlify (Next.js).
- **API + workers:** separate Docker-capable host (long-running jobs don't
  belong in serverless functions).
- **Local:** `docker compose up` (postgres + api + web).

## Later milestones (not built yet)

Director/Designer (M1), Architect/Builder (M2), Playtester (M3),
Triage/Fixer/Regression (M4), live Studio + Publish (M5). See the blueprint.
