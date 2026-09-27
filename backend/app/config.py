from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration, loaded from environment / .env"""

    database_url: str = "postgresql://postgres:postgres@localhost:5432/aivoa_deviations"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
