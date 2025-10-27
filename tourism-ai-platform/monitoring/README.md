# Monitoring

## Overview
The monitoring workspace packages the observability stack (Prometheus, Grafana, Loki, Tempo, Promtail, exporters) that captures telemetry for the multi-tenant Synchron AI Hub. It includes Docker Compose assets for local smoke tests and Kubernetes manifests for production environments. Refer to [Architecture](../docs/ARCHITECTURE.md) for the platform topology and [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md) for rollout procedures.

## Tenant Awareness
- Metrics emitted by backend and AI services include `tenant_id` labels, enabling Grafana dashboards to filter per tenant (e.g., `tenant_id="chat365"`).
- Tempo stores spans with attributes `tenant_id`, `event_type`, and `hub.topic`, ensuring cross-service traces remain segregated.
- Loki labels logs with `tenant` via Fluent/PROMTAIL pipelines so dashboards support tenant-based search without sharing sensitive payloads.

## Connections
| Service | Path | Purpose |
|---------|------|---------|
| **Prometheus** | `prometheus/prometheus.yml` | Scrapes backend `/metrics`, `/hub/metrics`, Redis/Kafka exporters |
| **Tempo** | `tempo/tempo.yml` | Receives OTLP traces from backend/orchestrator |
| **Loki + Promtail** | `loki.yaml`, `promtail-config.yml` | Collects structured logs from all services |
| **Grafana** | `grafana/` | Pre-provisioned dashboards for tenants, infrastructure, and tracing |
| **Exporters** | Compose services | PostgreSQL, Redis, Node exporters for platform components |

## Deployment
- Local: `docker/docker-compose.yml` orchestrates the full monitoring stack; volumes (`monitoring/loki_data`, `monitoring/prometheus`) persist data.
- Kubernetes: apply manifests under `infrastructure/kubernetes/monitoring/` with PVCs sized for your retention policy.
- Environment variables for Grafana/Prometheus credentials should be supplied via secrets (`GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD`).
- Configure ingress/port-forwarding to expose Grafana (3001), Prometheus (9090), Tempo (4318/4319).

## Metrics & Observability
- Prometheus dashboards highlight tenant routing (`hub_tenant_request_total`), orchestrator health, and exporter metrics.
- Tempo provides span queries for `ai.orchestrator.dispatch`, `conversation.handle`, and `whatsapp.sendTemplate`.
- Grafana uses datasource provisioning stored in `grafana/provisioning/`; dashboards include “Backend Overview”, “AI Orchestrator”, and “Tenant Experience”.
- Alert rules should extend `prometheus/rules/alerts.yml` to monitor queue depth, token expiry failures, and Kafka lag.

## CI/CD
- `tenant-validation.yml` spins up the monitoring Docker Compose services to confirm `/hub/metrics` emits tenant labels during smoke tests.
- `deploy-staging.yml` / `deploy-production.yml` bundle the monitoring charts for ArgoCD sync in tandem with backend/AI service deploys.
- Future enhancements can integrate Grafana provisioning checks in `ci-backend.yml` to guard against mismatched dashboards.

## Examples
### `.env.local`
```env
# monitoring/.env.local
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin123
PROMETHEUS_STORAGE_RETENTION=15d
TEMPO_RETENTION=7d
```

### Trigger Hub Event
```bash
curl -X POST http://localhost:4000/api/hub/events \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant: chat365' \
  -d '{"id":"evt-observe","tenantId":"chat365","type":"observability.check","source":"monitoring","timestamp":"2024-04-01T12:00:00Z","payload":{"note":"verifying dashboards"}}'
```

### Redis Key Patterns
- `chat365:hub:metrics:last-seen` – Example custom key for scrape freshness.
- `chat365:onlychannel:token` – Cached credential monitored by Prometheus exporter rules.
- `chat365:hub:context` – Context entries that Grafana dashboards surface through Redis panels.
