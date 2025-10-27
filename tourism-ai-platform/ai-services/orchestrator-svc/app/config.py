from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ai-orchestrator"
    redis_url: str = Field("redis://localhost:6379/1", env="REDIS_URL")
    kafka_brokers: List[str] = Field(default_factory=lambda: ["localhost:9092"], env="KAFKA_BROKERS")
    langsmith_api_key: str | None = Field(default=None, env="LANGSMITH_API_KEY")
    otel_endpoint: str | None = Field(default=None, env="OTEL_EXPORTER_OTLP_ENDPOINT")
    s3_endpoint: str = Field("http://localhost:9000", env="S3_ENDPOINT")
    s3_bucket: str = Field("health-tourism-docs-local", env="S3_BUCKET")
    s3_access_key: str = Field("minioadmin", env="S3_ACCESS_KEY")
    s3_secret_key: str = Field("minioadmin", env="S3_SECRET_KEY")
    backend_base_url: str = Field("http://localhost:4000/api", env="BACKEND_BASE_URL")
    amadeus_base_url: str = Field("https://api.test.amadeus.com", env="AMADEUS_BASE_URL")
    amadeus_api_key: str | None = Field(default=None, env="AMADEUS_API_KEY")
    amadeus_api_secret: str | None = Field(default=None, env="AMADEUS_API_SECRET")
    non_diagnostic_disclaimer: str = Field(
        "This orchestration output is educational and non-diagnostic."
    )
    graph_namespace: str = Field("orchestrator", env="GRAPH_NAMESPACE")
    hub_namespace: str = Field("hub", env="HUB_NAMESPACE")
    hub_registry_url: str = Field("http://localhost:8200", env="HUB_REGISTRY_URL")
    hub_registry_api_key: str | None = Field(default=None, env="HUB_REGISTRY_API_KEY")
    hub_kafka_topic: str = Field("ai.agent.events", env="HUB_KAFKA_TOPIC")
    hub_topic_suffix: str = Field("hub.events", env="HUB_TOPIC_SUFFIX")
    hub_redis_stream: str = Field("hub:events", env="HUB_REDIS_STREAM")
    hub_default_ttl: int = Field(600, env="HUB_DEFAULT_TTL")

    @field_validator("kafka_brokers", mode="before")
    @classmethod
    def _split_brokers(cls, value):
        if isinstance(value, str):
            return [broker.strip() for broker in value.split(",") if broker.strip()]
        return value

    class Config:
        env_prefix = ""
        env_file = ".env.local"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
