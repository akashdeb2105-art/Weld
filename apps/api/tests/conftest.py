"""Test fixtures — hermetic SQLite database, migrated via Alembic, seeded."""

import os
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_tmp = tempfile.mkdtemp(prefix="weld-test-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{_tmp}/test.db"
os.environ["ENVIRONMENT"] = "test"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

from app.db import Base, get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_sample_project  # noqa: E402

API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session", autouse=True)
def migrated_db() -> Iterator[str]:
    url = os.environ["DATABASE_URL"]
    cfg = Config(os.path.join(API_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(API_DIR, "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    yield url
    command.downgrade(cfg, "base")


@pytest.fixture()
def client(migrated_db: str) -> Iterator[TestClient]:
    engine = create_engine(migrated_db, connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with TestingSession() as session:
        seed_sample_project(session)

    def override_get_session() -> Iterator:
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
