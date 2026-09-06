# Contributing to WELD

Thanks for helping build WELD. A few principles keep the project coherent.

## The golden rule: no fake features

Never ship UI that implies functionality the backend doesn't have. If a feature
isn't real yet, label it with the milestone it lands in (e.g. `· M1`) or don't
show it. This is the project's most important rule (blueprint §73).

## Milestones

Work lands in vertical milestones (M0 → M1 → …). Keep changes inside the
current milestone's scope; don't expand autonomously.

## Setup

See [README.md](README.md) and [docs/local-development.md](docs/local-development.md).

```bash
npm install
pip install -r backend/requirements-dev.txt
docker compose up postgres
```

## Before you open a PR

All must pass locally (and in CI):

```bash
npm run lint
npm run typecheck
npm test
cd backend && python -m pytest
npm run build
npm run e2e
```

## Conventions

- **TypeScript strict** everywhere. No `any` without justification.
- **Commits:** Conventional-ish, scoped — e.g. `feat(gamebible): add level schema`,
  `test(sample-game): cover restart invariant`, `docs: update architecture`.
- **Schemas are contracts.** Changing `packages/gamebible` means bumping
  `schemaVersion` and updating the fixture + the API mirror + docs.
- **Determinism.** Game logic must not use wall-clock or unseeded randomness.
- **Dependencies:** verify a package exists, is maintained, and is licensed
  compatibly before adding it; update the lockfile; build and test after.

## Git

Local commits are fine. **Never push to GitHub without the project owner's
explicit approval.** Never force-push unless explicitly instructed.
