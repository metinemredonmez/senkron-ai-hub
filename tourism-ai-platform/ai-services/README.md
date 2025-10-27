# AI Services (`ai-services/`)

## Overview
The AI Services workspace contains the FastAPI-based orchestrator (`orchestrator-svc`) and shared `ai_services.hub_core` utilities that execute multi-tenant workflows for the Synchron AI Hub. These services coordinate LangGraph agents, manage tenant registries, and bridge events between the NestJS backend and downstream tools. See [Architecture](../docs/ARCHITECTURE.md) for the full system view and [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md) for rollout specifics.

## Tenant Awareness
- `TenantContextMiddleware` resolves `X-Tenant` headers and annotates spans so every orchestrated request keeps tenant context.
- `ai_services.hub_core.context_manager.ContextManager` stores per-tenant state in Redis using keys like `{tenantId}:hub:context`.
- `RegistryClient` and `HubRegistry` cache per-tenant agents (`tenant.{id}.ai.agent.events`) and surface only the agents registered for the active tenant.
- Event publishing prefixes Kafka topics and Redis streams with the tenant ID (`tenant.{id}.hub.events`).

## Connections
| Component | Purpose | Reference |
|-----------|---------|-----------|
| **Backend HubCore** | Receives `/hub/events/publish` and provides registry APIs | `orchestrator-svc/app/services/event_bus.py` |
| **Redis** | Tenant/session state, workflow checkpoints | `ai_services.hub_core.context_manager.ContextManager` |
| **Kafka** | Emits agent responses and hub events with tenant topics | `orchestrator-svc/app/services/event_bus.py` |
| **Prometheus / Tempo** | Expose `/metrics`, OTLP spans (`agent.response`, `hub.router`) | `ai_services.hub_core.metrics_collector.MetricsCollector` |
| **External APIs** | Doctor365, Amadeus, S3 utilities shared by orchestrator | `orchestrator-svc/app/tools/*` |

## Deployment
- Required env vars: `REDIS_URL`, `HUB_REGISTRY_URL`, `HUB_KAFKA_TOPIC`, `HUB_TOPIC_SUFFIX`, `HUB_REDIS_STREAM`, `OTEL_EXPORTER_OTLP_ENDPOINT`, provider keys (`OPENAI_API_KEY`, `AMADEUS_*`).
- Helm/ArgoCD charts should configure the orchestrator service at `values.ai.orchestrator.*` and mount secrets for Redis/Kafka credentials.
- Container image is built from `ai-services/orchestrator-svc/Dockerfile`; manifests reside under `infrastructure/kubernetes/ai/`.
- Enable scaling by running multiple orchestrator replicas behind a shared Redis.

## Metrics & Observability
- `/metrics` (FastAPI) exposes Prometheus histograms (`agent_latency_seconds`, `tenant_request_count`) labelled with `tenant_id` and `event_type`.
- OpenTelemetry instrumentation emits spans for workflow nodes, agent execution, and Kafka publishes, propagating the `tenant_id` attribute.
- Logs can be shipped to Loki via stdout or wrapped with LangSmith telemetry for debugging flows.

## CI/CD
- `tenant-validation.yml` boots orchestrator alongside the backend during smoke tests.
- `ci-backend.yml` ensures hub contract tests remain compatible (shared DTOs) and runs orchestrator unit tests through `pytest`.
- `deploy-staging.yml` / `deploy-production.yml` package the orchestrator image together with backend deployments for synchronized releases.

## Examples
### `.env.local`
```env
# ai-services/orchestrator-svc/.env.local
REDIS_URL=redis://localhost:6379/1
HUB_REGISTRY_URL=http://localhost:4000/api/hub
HUB_KAFKA_TOPIC=ai.agent.events
HUB_TOPIC_SUFFIX=hub.events
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

### Trigger Hub Event
```bash
curl -X POST http://localhost:4000/api/hub/events \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant: chat365' \
  -d '{
        "id": "evt-tenant-ai",
        "tenantId": "chat365",
        "type": "ai.workflow.enqueued",
        "source": "orchestrator",
        "timestamp": "2024-04-01T12:00:00Z",
        "payload": { "caseId": "case-123" }
      }'
```

### Redis Key Patterns
- `chat365:hub:context` – Tenant configuration cached by `ContextManager`.
- `chat365:hub:session:{sessionId}` – Session state for LangGraph runs.
- `chat365:hub:registry:agents` – Cached agent registry for the tenant.
- `chat365:hub:events` – Redis stream storing recent hub events.
