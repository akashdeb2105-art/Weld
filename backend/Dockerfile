# WELD API image
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Install API deps (no dev extras in the image).
COPY backend/pyproject.toml ./backend/pyproject.toml
RUN pip install --no-cache-dir \
    "fastapi>=0.115" \
    "uvicorn[standard]>=0.34" \
    "pydantic>=2.10" \
    "pydantic-settings>=2.7" \
    "sqlalchemy>=2.0" \
    "alembic>=1.14" \
    "psycopg[binary]>=3.2"

# App source + migrations + the shared GameBible fixture the seed reads.
COPY backend ./backend
COPY packages/gamebible/src/scrap-sprint.gamebible.json ./packages/gamebible/src/scrap-sprint.gamebible.json

WORKDIR /srv/backend

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
