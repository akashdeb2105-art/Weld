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

    # --- Game Director (M1) -------------------------------------------------
    # LLM provider settings. When no API key is configured the Director falls
    # back to a deterministic offline interpreter so the product never fakes
    # output and stays fully testable (blueprint: never fake AI).
    llm_provider: str = "openai"  # only "openai" supported in M1
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    director_timeout_seconds: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key.strip())


settings = Settings()
