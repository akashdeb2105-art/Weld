# Local development

## Prereqs

- Node 20+ and npm 10+
- Python 3.12+
- Docker + Docker Compose (for Postgres and the full stack)

## One-time setup

```bash
npm install
python -m venv backend/.venv
# Windows:  backend/.venv/Scripts/pip install -r backend/requirements-dev.txt
# mac/linux: backend/.venv/bin/pip install -r backend/requirements-dev.txt
cp .env.example .env
```

## Run everything (recommended)

```bash
docker compose up --build
# web  â†’ http://localhost:3000
# api  â†’ http://localhost:8000/health
```

## Run pieces separately

**Postgres only:**

```bash
docker compose up postgres
```

**API** (with auto-reload; Alembic ensures schema, startup seeds the sample):

```bash
cd backend
../.venv/Scripts/alembic upgrade head        # Unix: ../.venv/bin/alembic
../.venv/Scripts/uvicorn app.main:app --reload
```

**Web** (builds/copies the sample game on start):

```bash
npm run build -w @weld/sample-game   # once, or after game changes
npm run dev -w @weld/web             # http://localhost:3000
```

## Tests

```bash
npm test                            # gamebible + sample-game + web (Vitest)
cd backend && python -m pytest     # API (hermetic SQLite + migrations)
npm run e2e                         # Playwright smoke (boots API + web)
npm run lint && npm run typecheck
```

## Environment

All config is via env vars documented in `.env.example`. Tests override
`DATABASE_URL` with a hermetic SQLite file, so `pytest` and `npm run e2e` need
no live Postgres and make no network or model calls.

## Resetting

```bash
docker compose down -v   # drops the postgres volume
```
