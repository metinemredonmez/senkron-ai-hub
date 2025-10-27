# Synchron AI Hub — Backend (NestJS Core)

## Overview
The backend is the heart of the Synchron AI Hub. It exposes tenant-aware REST APIs under `/api`, coordinates hub events through `/api/hub/*`, and orchestrates journeys across care, travel, and payment domains. Built on NestJS 10, it layers HubCore modules (registry, event bus, telemetry) on top of PostgreSQL, Redis, Kafka, and S3-compatible storage. Every request flows through multi-tenant guards, ensuring each hospital, partner, or marketplace instance remains isolated while sharing the same codebase.

## Tenant Awareness
- **Headers & Tokens** – Every request must include `X-Tenant` or a tenant-scoped JWT/OnlyChannel token. `TenantContextInterceptor` pushes the tenant id into AsyncLocalStorage so services, repositories, and observability data remain scoped.
- **Redis Key Patterns** – Context and orchestration state are stored as `tenant:{tenantId}:hub:*` (sessions TTL 24h), OnlyChannel tokens as `tenant:{tenantId}:onlychannel:token` (55m TTL), Doktor365 OAuth caches as `tenant:{tenantId}:doktor365:token` (55m TTL).
- **Row-Level Isolation** – Entity repositories extend tenant-aware base classes; queries automatically constrain to `tenant_id`. Rate limiting and idempotency keys are hashed per tenant (`rate:{tenantId}:{route}`, `idem:{tenantId}:{hash}`).

## Connections
| Integration | Description | Direction |
|-------------|-------------|-----------|
| **HubCore Modules** | Agent registry, orchestrator dispatch, metrics sync, tenant caching | Internal |
| **OnlyChannel / Chat365** | Messaging bridge & token rotation | Backend ↔ OnlyChannel |
| **Doktor365** | Patient synchronization & appointment proxy | Backend ↔ Doktor365 |
| **Kafka** | Publishes `tenant.{id}.hub.events` and consumes orchestrator callbacks | Backend ↔ Kafka |
| **Redis** | Context store, throttling, idempotency, cache | Backend ↔ Redis |
| **Observability Stack** | Prometheus `/metrics` & `/hub/metrics`, Tempo OTLP traces, Loki logs | Backend → Monitoring |

## Deployment
- **Key Environment Variables** – `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `AI_ORCHESTRATOR_URL`, `HUB_REGISTRY_URL`, `PROMETHEUS_PUSHGATEWAY_URL`, `TEMPO_ENDPOINT`, `ONLYCHANNEL_BASE_URL`, `DOKTOR365_SECRET`, `FIELD_ENCRYPTION_KEY`, `JWT_SECRET`.
- **Helm/ArgoCD** – Production deploys rely on `deploy-staging.yml` / `deploy-production.yml` to build Docker images and trigger ArgoCD sync. Secrets are injected via External Secrets (AWS/GCP) and ConfigMaps map non-sensitive defaults.
- **Scaling Guidance** – Backend pods are stateless; horizontal scaling depends on shared Redis, PostgreSQL read replicas, and Kafka partitions. HubCore ensures metrics registry is singleton per pod to avoid duplicate counters.
- **Ingress** – Expose `/api/*`, `/metrics`, `/hub/metrics`, and `/docs/swagger.*`. Health probes hit `/api/health` and `/api/hub/metrics` for readiness.

## Metrics & Observability
- **Prometheus** – Default metrics plus hub counters (`hub_tenant_request_total`, `hub_agent_latency_seconds`, `hub_agent_error_total`, `hub_orchestrator_health`) served at `/api/metrics` and `/api/hub/metrics`.
- **Tempo** – OTLP spans (HTTP) include `tenant_id`, `trace_id`, and orchestrator timings. Tempo config enables searching on `tenant_id`.
- **Loki & Grafana** – Pino logs ship structured JSON with tenant context; Grafana dashboards provide `$tenant_id` template vars to filter hub traffic.
- **Pushgateway (Optional)** – TelemetrySyncService pushes custom snapshots when `PROMETHEUS_PUSHGATEWAY_URL` is configured.

## CI/CD
- **Backend CI (`ci-backend.yml`)** – Runs lint, unit, e2e tests, and build whenever backend files change.
- **Tenant Validation (`tenant-validation.yml`)** – Boots Docker compose (Postgres, Redis, Kafka, Tempo, Prometheus, Grafana), launches backend & orchestrator, runs tenant smoke tests, captures `/hub/metrics`, and uploads Swagger artifacts.
- **Deploy Pipelines** – `deploy-staging.yml` and `deploy-production.yml` build/push images to GHCR and trigger ArgoCD to update backend and AI services.

## Examples
### Fire a Hub Event
```bash
curl -X POST http://localhost:4000/api/hub/events \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant: chat365' \
  -H 'Authorization: Bearer <tenant-jwt-or-onlychannel-token>' \
  -d '{
        "id": "evt-123",
        "tenantId": "chat365",
        "type": "conversation.message",
        "source": "onlychannel",
        "timestamp": "2024-04-01T12:00:00Z",
        "payload": { "message": "hello from curl" }
      }'
```

### Redis Key Cheatsheet
- `tenant:chat365:hub:context` — Hub orchestration context snapshot (24h TTL).
- `tenant:chat365:hub:session:{sessionId}` — In-flight workflow session (24h TTL).
- `tenant:chat365:onlychannel:token` — Cached OnlyChannel access token (55m TTL).
- `tenant:chat365:doktor365:token` — Cached Doktor365 OAuth token (55m TTL).
