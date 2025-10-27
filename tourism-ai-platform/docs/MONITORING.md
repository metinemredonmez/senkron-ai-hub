# 📊 Monitoring & Observability (Production Readiness)

Comprehensive telemetry stack for the Health Tourism AI Platform. Covers metrics, logs, traces, and validation commands for local Docker and Kubernetes staging.

---

## Stack Components

| Service | Source | Port | Notes |
|---------|--------|------|-------|
| Prometheus | Docker/K8s | 9090 | Scrapes metrics and evaluates alert rules |
| Postgres Exporter | Docker | 9187 | `prometheuscommunity/postgres-exporter` publishing DB stats |
| Redis Exporter | Docker | 9121 | `oliver006/redis_exporter` connected to Redis 7 |
| Loki | Docker/K8s | 3100 | Log aggregation via Promtail sidecars |
| Tempo | Docker/K8s | 4318 (gRPC) / 4319 (HTTP) | Receives OpenTelemetry spans |
| Grafana | Docker/K8s | 3001 | Dashboards, alerts, Explore (Loki/Tempo) |

Datasources are provisioned automatically from `monitoring/grafana/provisioning/datasource.yml`.

---

## Prometheus Scrape Targets

`monitoring/prometheus.yml` defines the following jobs:

```yaml
scrape_configs:
  - job_name: backend
    metrics_path: /metrics
    static_configs:
      - targets: ["host.docker.internal:4000"]
  - job_name: orchestrator
    static_configs:
      - targets: ["host.docker.internal:8080"]
  - job_name: postgres
    static_configs:
      - targets: ["postgres-exporter:9187"]
  - job_name: redis
    static_configs:
      - targets: ["redis-exporter:9121"]
  - job_name: qdrant
    static_configs:
      - targets: ["qdrant:6333"]
```

> The Docker `prometheus` service declares `extra_hosts: ["host.docker.internal:host-gateway"]` so containers can reach the host-exposed backend metrics.

---

## Manual Validation Commands

Run these **manually** (no automation) after bringing up the Docker stack:

```bash
# Service health
curl -s http://localhost:4000/api/health
curl -s http://localhost:8080/health

# Metrics pipeline
curl -s http://localhost:4000/metrics | head -n 5
curl -s http://localhost:9121/metrics | head -n 5        # Redis exporter
curl -s http://localhost:9187/metrics | head -n 5        # Postgres exporter
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets'

# Logs & traces
curl -s http://localhost:3100/ready
curl -s http://localhost:4318/metrics | head -n 5
```

Grafana dashboards to review:
- **Infrastructure Health** – exporter status, host metrics
- **Backend Service** – latency, error rates, route saturation
- **AI Orchestrator** – workflow stages, approvals, retries
- **Tracing Overview** – use Grafana Explore → Tempo and filter by `service.name="health-tourism-backend"` or `ai.case.id`

---

## Kubernetes (Staging)

1. Set context:  
   `kubectl config use-context staging`  
   *(requires cluster/user to be configured beforehand).*
2. Apply manifests:  
   `kubectl apply -f infrastructure/kubernetes/monitoring/`
3. Verify pods and services:  
   `kubectl get pods -n monitoring`  
   `kubectl get svc -n monitoring`
4. Port-forward for diagnostics (optional):  
   `kubectl port-forward -n monitoring svc/prometheus 9090:80`  
   `kubectl port-forward -n monitoring svc/grafana 3001:80`

Alert rules and dashboards are loaded from ConfigMaps mounted in the Grafana/Prometheus StatefulSets.

---

## Key Metrics & Alerts

- `integration_request_duration_seconds` – backend integration latency histogram.
- `conversation_pipeline_duration_seconds` – orchestrator pipeline duration.
- `comms_intents_total` – outbound comms by channel/template.
- `redis_commands_processed_total` – via redis exporter.
- `pg_stat_activity_count` / `pg_up` – via postgres exporter.
- Alert examples: backend latency p95 > 3s, Redis exporter down, Tempo ingest errors.

---

## Log & Trace Hygiene

- Pino logging interceptor redacts PII before shipping to Loki.
- Loki labels include `tenant`, `correlationId`, `integration_call`.
- OpenTelemetry spans propagate from NestJS → FastAPI orchestrator with attributes:
  - `ai.case.id`
  - `ai.case.tenant`
  - `http.method`, `http.status_code`

Tempo exposes ready status at `http://tempo:4319/status` (K8s) and metrics at `:4318/metrics`.
