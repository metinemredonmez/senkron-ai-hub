from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ai-nlp"
    qdrant_enabled: bool = False
    qdrant_url: str = "http://qdrant:6333"
    pg_dsn: str | None = None

    class Config:
        env_prefix = "AINLP_"
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
