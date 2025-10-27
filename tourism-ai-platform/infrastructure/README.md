# Infrastructure

## Overview
The infrastructure directory defines how the Synchron AI Hub is provisioned across local Docker Compose stacks and Kubernetes clusters. It includes reusable Helm/ArgoCD manifests, Terraform-style values, and deployment scripts that wire the backend, AI services, frontend, and observability stack together. Architecture assumptions are detailed in [Architecture](../docs/ARCHITECTURE.md) with rollout steps in [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md).

## Tenant Awareness
- Namespaces and Helm values provide tenant-agnostic deployments; tenant isolation occurs at the application layer via `X-Tenant` propagation.
- Redis, Kafka, and databases are shared multi-tenant resources; manifests ensure high availability and TLS for cross-tenant workloads.
- Sealed secrets / External Secrets supply per-tenant credentials (OnlyChannel, Doktor365) which are mounted into backend pods without hard-coding tenant values.

## Connections
| Component | Definition Path | Purpose |
|-----------|-----------------|---------|
| Backend & HubCore | `kubernetes/backend/` | Deploys NestJS pods, services, and ingress |
| AI Orchestrator | `kubernetes/ai/` | FastAPI orchestrator deployment and autoscaling |
| Frontend | `kubernetes/frontend/` | Next.js portal with CDN-friendly service |
| Observability | `kubernetes/monitoring/` & `docker/` | Prometheus, Grafana, Tempo, Loki |
| Messaging & Cache | `kubernetes/platform/redis`, `kubernetes/platform/kafka` | Shared Redis & Kafka clusters for tenant-aware orchestration |

## Deployment
- Helm releases are coordinated through ArgoCD applications stored in `argo/` overlays; set environment-specific values before promoting.
- Required environment variables/secrets:
  - `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `AI_ORCHESTRATOR_URL`
  - `HUB_REGISTRY_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `PROMETHEUS_PUSHGATEWAY_URL`, `TEMPO_ENDPOINT`
  - `DOKTOR365_BASE_URL`, `DOKTOR365_SECRET`, `ONLYCHANNEL_BASE_URL`, `ONLYCHANNEL_ACCOUNT_TOKEN`
- Local bootstrap: `docker/docker-compose.yml` spins up Redis, Kafka, Tempo, Prometheus, Grafana, backend, orchestrator, and frontend for smoke testing.
- Production guidance: enable Horizontal Pod Autoscalers, PodDisruptionBudgets, and cluster-wide TLS for ingress controllers.

### Tenant Deployment Checklist
- `HUB_REGISTRY_URL`
- `PROMETHEUS_PUSHGATEWAY_URL`
- `TEMPO_ENDPOINT`
- `DOKTOR365_SECRET`
- `ONLYCHANNEL_ACCOUNT_TOKEN`

## Metrics & Observability
- Prometheus scrape configurations reside under `monitoring/prometheus/`; update `targets` to match cluster service names.
- Tempo and Loki endpoints used by the backend/AI services (`http://tempo:4318/v1/traces`, `http://loki:3100`) are exposed through corresponding services.
- Ensure NetworkPolicies allow OTLP (4318/4319) and Prometheus scrapes (9090) between namespaces.

## CI/CD
- `deploy-staging.yml` and `deploy-production.yml` GitHub workflows publish container images and trigger ArgoCD syncs with the manifests here.
- `tenant-validation.yml` uses Docker Compose overrides from `infrastructure/docker/` to run integration smoke tests before deployment.
- Repository hooks validate Kubernetes manifests via `kubectl kustomize` and lint Docker Compose files.

## Examples
### `.env.local`
```env
# infrastructure/docker/.env.local
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=kafka:9092
ONLYCHANNEL_BASE_URL=https://api.chat365.com.tr
ONLYCHANNEL_ACCOUNT_TOKEN=ak_1b9ee7f16118d8ddad4248b70dc2cf15_7b09e388
```

### Trigger Hub Event
```bash
curl -X POST http://localhost:4000/api/hub/events \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant: chat365' \
  -d '{"id":"evt-infra","tenantId":"chat365","type":"infra.deploy","source":"argo","timestamp":"2024-04-01T12:00:00Z","payload":{"buildId":"42"}}'
```

### Redis Key Patterns
- `chat365:hub:registry:agents` – Cached agent list per tenant (populated by orchestrator & backend).
- `chat365:onlychannel:token` – Chat365 token managed by backend and refreshed by infrastructure secrets.
- `chat365:hub:events` – Redis stream retained for observability/testing via Docker Compose.
