# WELD Architecture

Modular monorepo. One deployable web app, one API, shared schema packages.
Nothing distributed until measurements justify it.

## High level

```text
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  Browser  â”€â”€â”€â–º â”‚  apps/web  (Next.js)                       â”‚
                â”‚   /          public landing (real embed)   â”‚
                â”‚   /app       projects                      â”‚
                â”‚   /app/studio/[slug]  Studio               â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚ server-side fetch (no client-exposed internal URLs)
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  apps/api  (FastAPI)                       â”‚
                â”‚   /health                                  â”‚
                â”‚   /api/v1/projects[/:slug[/gamebible|jobs]]â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚ SQLAlchemy
                       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
                       â”‚  PostgreSQL     â”‚
                       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

  packages/gamebible   GameBible schema + fixture (shared source of truth)
  packages/sample-game Scrap Sprint (Phaser 3), driven by the fixture
```

## Boundaries (blueprint Â§107)

| Boundary   | Where | Rule |
| ---------- | ----- | ---- |
| schema     | `packages/gamebible` | Single contract; versioned; strict |
| artifacts  | fixture + DB JSON | Structured, inspectable, resumable |
| game       | `packages/sample-game` | Ordinary editable source, engine-agnostic logic core |
| runtime    | web sandboxed iframe | Untrusted code never runs in the API process |
| api        | `apps/api` | Thin HTTP over Pydantic schemas |

## The GameBible as the spine

Every project starts from a GameBible. In M0 the sample game *is built from*
its GameBible fixture (`packages/gamebible/src/scrap-sprint.gamebible.json`):
the Phaser scene reads level bounds, spawns, timer, controls, and win target
from it. The API validates and serves the same fixture. The Studio renders it.
One artifact, four consumers â€” that's the pattern the AI crew inherits in M1+.

## The sample game's logic/render split

`packages/sample-game/src/game/logic.ts` is a pure, deterministic simulation
(no Phaser, no wall-clock, no RNG). Phaser (`scenes/GameScene.ts`) only renders
state and feeds intents. Consequences:

- Unit tests run in Node in milliseconds.
- The future Playtester asserts on real numeric state via `window.__WELD__`.
- A different renderer could replace Phaser without touching the rules.

## Honest states, no fake streams

There is deliberately **no SSE/event stream in M0** â€” there is no engine to
stream from. The Studio's playhead tracks the *real* game status via the
game's postMessage bridge. Event streaming lands with the engine (M5).

## The Game Director (M1)

`apps/api/app/director.py` turns a plain-language prompt into a **validated
GameBible**. It is the first AI role, and it is honest about how it works:

- **LLM mode** — when `LLM_API_KEY` is set, an OpenAI-compatible chat call
  drafts the document. The output is *always* re-validated against the
  GameBible contract before it is used, so a hallucinating model cannot emit
  an invalid spec.
- **Offline mode** — with no key, a deterministic interpreter composes a real,
  playable spec from the prompt's actual signals (genre, collectible, hazard).
  The result is labeled `offline_draft` / `template_composed` — never passed
  off as LLM output. This keeps the feature working and fully testable with no
  secrets and no network.

M1 only supports the genres the deterministic runtime can execute
(`top_down_arcade`, `platformer`, `dodge_survival`); anything else is rejected
with a clear error instead of a broken game. Every Director run is recorded as
a real `director_draft` job, so the Studio shows true provenance. The web app
calls it via `POST /api/v1/projects` through a Next.js server action (the
browser never sees internal URLs or keys).

## Deployment

- **Frontend/public site:** Netlify (Next.js).
- **API + workers:** separate Docker-capable host (long-running jobs don't
  belong in serverless functions).
- **Local:** `docker compose up` (postgres + api + web).

## Later milestones (not built yet)

Architect/Builder (M2), Playtester (M3), Triage/Fixer/Regression (M4),
live Studio + Publish (M5). See the blueprint.
