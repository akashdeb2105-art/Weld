"""API configuration via environment variables (pydantic-settings).

Defaults target the local docker-compose stack. Tests override DATABASE_URL
with a hermetic SQLite file so `pytest` needs no live Postgres.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://weld:weld-dev-only@localhost:5432/weld"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    environment: str = "development"
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
