"""API configuration via environment variables (pydantic-settings).

Defaults target the local docker-compose stack. Tests override DATABASE_URL
with a hermetic SQLite file so `pytest` needs no live Postgres.

Secrets (API keys) are read from a local, git-ignored `.env` file. They are
never committed and never logged.
"""

import os

from pydantic_settings import BaseSettings, SettingsConfigDict

# Which .env to load. Tests set WELD_ENV_FILE to a nonexistent path so they stay
# hermetic and never read a developer's real secrets from the repo .env.
_ENV_FILE = os.environ.get("WELD_ENV_FILE", ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://weld:weld-dev-only@localhost:5432/weld"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    environment: str = "development"
    log_level: str = "INFO"

    # --- Game Director (M1) -------------------------------------------------
    # The Director tries each configured provider in order and uses the first
    # one that answers. If none are configured it falls back to the honest
    # deterministic offline composer (blueprint: never fake AI).
    #
    # Provider 1 (primary): Fireworks — GLM 5.3 / Kimi K3 (OpenAI-compatible).
    fireworks_api_key: str = ""
    fireworks_base_url: str = "https://api.fireworks.ai/inference/v1"
    fireworks_model: str = "accounts/fireworks/models/glm-5p3-flash"
    fireworks_model_fallback: str = "accounts/fireworks/models/kimi-k3"
    # Provider 2 (fallback): Google AI Studio — Gemini Flash. Needs a real
    # AI Studio API key (starts with "AIza"); OAuth access tokens will not work.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    # Provider 3 (fallback): OpenRouter (OpenAI-compatible).
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"

    # Generic single-provider override (kept for backwards compatibility with
    # the original M1 LLM_* variables). If set, it is tried first.
    llm_provider: str = "openai"
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

    def director_providers(self) -> list[dict[str, str]]:
        """Return the ordered list of configured LLM providers.

        Each entry: {"name", "kind" ("openai"|"gemini"), "api_key",
        "base_url", "model"}. Only providers with a key are included.
        """
        providers: list[dict[str, str]] = []
        if self.llm_api_key.strip():
            providers.append({
                "name": "custom",
                "kind": "openai",
                "api_key": self.llm_api_key.strip(),
                "base_url": self.llm_base_url,
                "model": self.llm_model,
            })
        if self.fireworks_api_key.strip():
            providers.append({
                "name": "fireworks",
                "kind": "openai",
                "api_key": self.fireworks_api_key.strip(),
                "base_url": self.fireworks_base_url,
                "model": self.fireworks_model,
            })
        if self.gemini_api_key.strip():
            providers.append({
                "name": "gemini",
                "kind": "gemini",
                "api_key": self.gemini_api_key.strip(),
                "base_url": "https://generativelanguage.googleapis.com/v1beta",
                "model": self.gemini_model,
            })
        if self.openrouter_api_key.strip():
            providers.append({
                "name": "openrouter",
                "kind": "openai",
                "api_key": self.openrouter_api_key.strip(),
                "base_url": self.openrouter_base_url,
                "model": self.openrouter_model,
            })
        return providers


settings = Settings()
