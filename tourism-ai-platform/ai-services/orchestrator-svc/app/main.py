from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, Dict

# Ensure the shared ai_services package is available when running via uvicorn
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from ai_services.hub_core import (
    ContextManager,
    HubRouter as CoreHubRouter,
    MetricsCollector,
    RegistryClient,
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .config import get_settings
from .graph.workflow import compile_workflow, configure_workflow_dependencies
from .middleware.langsmith_trace import LangsmithTracer
from .middleware.tenant_context import TenantContextMiddleware
from .routers import agents_router, hub_router, orchestrator_router
from .services import AgentExecutor, EventBus, HubRegistry, TenantContextService
from .tools.amadeus import AmadeusTool
from .tools.d365 import Doctor365Tool
from .tools.s3 import S3Tool
from .utils.kafka_producer import KafkaEventProducer
from .utils.redis_store import RedisStore


def configure_tracing(service_name: str, endpoint: str | None) -> None:
    if not endpoint:
        return
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_tracing(settings.app_name, settings.otel_endpoint)

    app = FastAPI(title="Health Tourism AI Orchestrator", version="2.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(TenantContextMiddleware)

    redis_store = RedisStore(settings.redis_url, namespace=settings.graph_namespace)
    kafka_producer = KafkaEventProducer(settings.kafka_brokers)
    langsmith = LangsmithTracer(settings.langsmith_api_key)
    d365_tool = Doctor365Tool(settings.backend_base_url)
    amadeus_tool = AmadeusTool(settings.amadeus_base_url)
    s3_tool = S3Tool(
        settings.s3_endpoint,
        settings.s3_access_key,
        settings.s3_secret_key,
        settings.s3_bucket,
    )
    context_manager = ContextManager(settings.redis_url, namespace=settings.hub_namespace)
    registry_client = RegistryClient(
        settings.hub_registry_url,
        api_key=settings.hub_registry_api_key,
        context_manager=context_manager,
    )
    metrics = MetricsCollector()
    hub_registry = HubRegistry(client=registry_client)
    tenant_context = TenantContextService(
        context_manager=context_manager,
        registry_client=registry_client,
        default_ttl=settings.hub_default_ttl,
    )
    event_bus = EventBus(
        kafka_producer=kafka_producer,
        context_manager=context_manager,
        kafka_topic=settings.hub_kafka_topic,
        redis_stream=settings.hub_redis_stream,
        hub_topic_suffix=settings.hub_topic_suffix,
    )
    agent_executor = AgentExecutor(
        tenant_context=tenant_context,
        registry=hub_registry,
        event_bus=event_bus,
        metrics=metrics,
    )
    hub_router = CoreHubRouter(
        registry=hub_registry,
        context_manager=context_manager,
        metrics=metrics,
        agent_executor=agent_executor,
        event_bus=event_bus,
        persist_stream=settings.hub_redis_stream,
    )

    configure_workflow_dependencies(
        redis=redis_store,
        kafka=kafka_producer,
        langsmith=langsmith,
        d365=d365_tool,
        amadeus=amadeus_tool,
        s3=s3_tool,
    )

    app.state.redis_store = redis_store
    app.state.kafka_producer = kafka_producer
    app.state.langsmith_tracer = langsmith
    app.state.case_inputs: Dict[str, Dict[str, Dict[str, Any]]] = {}
    app.state.d365_tool = d365_tool
    app.state.amadeus_tool = amadeus_tool
    app.state.s3_tool = s3_tool
    app.state.context_manager = context_manager
    app.state.registry_client = registry_client
    app.state.metrics_collector = metrics
    app.state.hub_registry = hub_registry
    app.state.tenant_context = tenant_context
    app.state.event_bus = event_bus
    app.state.agent_executor = agent_executor
    app.state.hub_router = hub_router
    app.state.hub_stream = settings.hub_redis_stream

    app.state.graph = compile_workflow(
        redis_url=settings.redis_url,
        namespace=settings.graph_namespace,
    )

    @app.on_event("startup")
    async def startup() -> None:
        await asyncio.gather(
            app.state.redis_store.connect(),
            app.state.kafka_producer.start(),
            app.state.context_manager.connect(),
            app.state.hub_registry.refresh(force=True),
        )

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await app.state.kafka_producer.stop()
        await app.state.redis_store.close()
        await app.state.context_manager.close()
        await app.state.d365_tool.close()
        await app.state.amadeus_tool.close()
        await app.state.agent_executor.close()
        await app.state.registry_client.close()

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": settings.app_name}

    @app.get("/metrics")
    async def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    app.include_router(hub_router)
    app.include_router(agents_router)
    app.include_router(orchestrator_router)
    return app


app = create_app()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
