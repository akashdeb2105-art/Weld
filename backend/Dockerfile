# WELD API image
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Install API runtime deps from the single source of truth (was a hand-copied
# list here that drifted — it missed httpx and crashed the API on startup).
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# App source + migrations + the shared GameBible fixture the seed reads.
COPY backend ./backend
COPY packages/gamebible/src/scrap-sprint.gamebible.json ./packages/gamebible/src/scrap-sprint.gamebible.json

WORKDIR /srv/backend

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
