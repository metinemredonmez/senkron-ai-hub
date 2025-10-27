# Deployment Guide (Environment Reference)

## Backend Environment Variables

The following variables must be configured in production (and mirrored in Helm/ArgoCD values) for tenant-safe hub orchestration:

- `HUB_REGISTRY_URL` – Backend hub registry endpoint (default `http://backend:4000/api/hub/registry` for in-cluster calls).
- `PROMETHEUS_PUSHGATEWAY_URL` – Prometheus Pushgateway used by `TelemetrySyncService` (default `http://prometheus:9091`).
- `TEMPO_ENDPOINT` – Tempo OTLP endpoint for telemetry fan-out (default `http://tempo:4318`).
- `DOKTOR365_SECRET` – HMAC secret provided by Doktor365 for webhook signature validation (no default; required).
- `DOKTOR365_BASE_URL` – Doktor365 API base URL (default `https://api.sandbox.doktor365.com`; override per environment).

Ensure these values are stored in your secret management solution and referenced by the backend deployment manifests. Missing or mismatched values will prevent telemetry push, hub registry sync, or webhook validation from functioning correctly.

## Hub Telemetry & Secrets Management

- Prometheus Pushgateway (`PROMETHEUS_PUSHGATEWAY_URL`) and Tempo OTLP endpoints (`TEMPO_ENDPOINT`, `OTEL_EXPORTER_OTLP_ENDPOINT`) must be defined per environment and sourced from Vault or AWS Secrets Manager; External Secrets inject them into both backend and orchestrator namespaces.
- Sensitive credentials such as `DOKTOR365_SECRET`, `ONLYCHANNEL_ACCOUNT_TOKEN`, and provider API keys should remain in Vault/Secrets Manager and surface in pods via sealed secrets or External Secrets.
- Helm environment overlays (for example `helm/values.{tenant}.yaml`) should template these variables to ensure each tenant deployment receives the correct telemetry endpoints and secrets without hard-coding them in manifests.
