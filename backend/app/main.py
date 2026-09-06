"""WELD API entrypoint."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import health, projects
from .seed import seed_sample_project
from .db import SessionLocal

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("weld.api")

app = FastAPI(title="WELD API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(projects.router)


@app.on_event("startup")
def startup() -> None:
    """Ensure schema + deterministic sample exist.

    In Docker, Alembic migrations run before the server starts; `create_all`
    is a no-op there. For bare-metal dev without Alembic it guarantees the
    schema exists so `weld dev` always works.
    """
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_sample_project(session)
    logger.info("WELD API ready (%s)", settings.environment)
