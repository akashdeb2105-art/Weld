# Changelog

All notable changes to WELD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to milestone-based development (M0, M1, …).

## [0.1.0] — M0 · 2026-09-06

The foundation milestone: real product surface, real playable sample, honest
states, zero faked AI.

### Added

- **Repository foundation** — npm workspaces monorepo (`apps/*`, `packages/*`),
  shared TS config, Prettier/ESLint, `.env.example`, hardened `.gitignore`,
  committed product blueprint.
- **GameBible schema** (`@weld/gamebible`) — versioned Zod contract (game,
  player, core loop, controls, win/lose, systems, visual direction, quality
  requirements, deterministic level definition) + canonical
  `scrap-sprint.gamebible.json` fixture + Vitest schema tests.
- **Sample game "Scrap Sprint"** (`@weld/sample-game`) — Phaser 3 + TypeScript,
  driven entirely by its GameBible. Pure, engine-free, deterministic logic core
  (movement, pickup, delivery, hazards, timer, win/lose, restart) with unit
  tests proving the invariants (timer never increases, lives never negative,
  score never decreases, restart resets state). Read-only `window.__WELD__`
  test bridge; procedural visuals (no external assets).
- **API** (`backend`) — FastAPI + Pydantic v2: `GET /health`,
  `GET /api/v1/projects`, `/projects/{slug}`, `/projects/{slug}/gamebible`,
  `/projects/{slug}/jobs`. SQLAlchemy models (projects, game_bibles, jobs),
  Alembic migration `0001`, idempotent deterministic seed. Hermetic pytest
  suite (SQLite + migrations).
- **Design system** — "Blueprint & Spark" tokens: Space Grotesk / Inter /
  IBM Plex Mono, ink/steel surfaces, spark-orange playhead accent, semantic
  state colors (building/running/testing/warning/failed/fixing/verified/
  published), motion tokens, full `prefers-reduced-motion` support, visible
  focus states.
- **Public website** (`/`) — art-directed landing: hero with live prompt→spec
  composition, **real playable game embed** with live state readout, the
  product loop scenes, evidence-based quality gates, CTA. No AI-purple, no
  orbs, no glassmorphism, no fake functionality.
- **Web app** (`/app`) — projects home (server-fetched from the API) and the
  **Studio** (`/app/studio/scrap-sprint`): left project nav, center playable
  game (the hero), right AI-crew roster + live game state + Game Bible, bottom
  pipeline playhead that tracks real game status. Crew roles honestly labeled
  by the milestone they land in — nothing pretends to work yet.
- **E2E** — Playwright smoke: landing → projects → Studio → game boots →
  `__WELD__` bridge responds → keyboard input moves the player. Hermetic
  (SQLite + seed + production build), no Docker/Postgres/model calls needed.
- **CI** — GitHub Actions: lint, typecheck, unit (TS + pytest), build, e2e.
- **Local dev** — `docker-compose.yml` (postgres + api + web), web/api
  Dockerfiles, dev scripts.
- **Docs** — README, SECURITY, CONTRIBUTING, docs/architecture.md,
  docs/local-development.md, docs/gamebible.md.

### Security

- No secrets committed; `.env` ignored, `.env.example` provided.
- Generated/sample game runs in a sandboxed iframe (`sandbox="allow-scripts"`)
  with no same-origin access to the parent app.
- `window.__WELD__` is read-only — structured state only, no code execution.

[0.1.0]: https://github.com/akashdeb2105-art/Weld/releases/tag/v0.1.0
