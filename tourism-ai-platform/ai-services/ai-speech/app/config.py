from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ai-speech"
    redis_url: str = "redis://redis:6379/2"
    presign_base_url: str = "https://storage.health-tourism.local/audio"

    class Config:
        env_prefix = "AISPEECH_"
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
