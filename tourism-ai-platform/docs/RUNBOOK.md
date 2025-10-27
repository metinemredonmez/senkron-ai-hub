# Synchron AI Platform Runbook

## Local development (no Docker services)

1. `yarn setup` – installs clean dependencies across workspaces.
2. `yarn dev` – starts the Nest backend, Next frontend, and orchestrator (needs Python deps).
3. `./tools/check-health.sh` – verifies `/api/health` and `/api/docs-json`.
4. `yarn smoke:backend` – runs Jest smoke checks against `http://localhost:4000`.

> Configure the smoke tests with environment variables:
> - `SMOKE_BASE_URL` (default `http://localhost:4000`)
> - `SMOKE_TENANT` (default `demo-tenant`)
> - `SMOKE_LOGIN_EMAIL` / `SMOKE_LOGIN_PASSWORD` for authenticated cases (optional).

## Local with Docker dependencies only

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d \
  postgres redis tempo prometheus grafana
```

- The compose file now injects database, Redis, S3, and telemetry env vars directly into the backend container.
- Tempo (`4318`) and Prometheus Pushgateway (`9091`) endpoints only come from Docker-specific defaults, so host-only runs stay silent.
- Run `./tools/check-health.sh` once the backend is reachable.

## Docker all-in-one stack

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

After services are healthy:

1. `yarn check:health`
2. `yarn smoke:backend`
3. (Optional) `TENANT=demo-tenant BACKEND_URL=http://localhost:4000 yarn smoke:artillery`

## Testing protected endpoints

- Supply `SMOKE_LOGIN_EMAIL` / `SMOKE_LOGIN_PASSWORD` before running `yarn smoke:backend` to exercise authenticated flows.
- `tools/smoke.http` provides ready-made REST Client calls; fill `{{TOKEN}}` with the JWT returned from `/api/auth/login`.
- The approvals helper uses placeholders (`{{CASE_ID}}`, `{{TASK_ID}}`)—populate them with real identifiers when available.

## Observability toggles

- Local/dev host runs skip OpenTelemetry automatically unless `DOCKER=1` is set.
- To push traces/metrics, ensure Tempo & Prometheus are running (Docker or remote) and export:
  - `OTEL_EXPORTER_OTLP_ENDPOINT`
  - `PROMETHEUS_PUSHGATEWAY_URL`
  - `TEMPO_ENDPOINT`

## Troubleshooting

- If `yarn setup` fails because of cache permissions, rerun with `sudo chown -R "$(whoami)" ~/.cache/yarn`.
- Database connection errors inside Docker usually mean the `.env` credentials are out of sync—run `yarn setup` or check `infrastructure/.env.local`.
- `smoke:artillery` requires the `artillery` CLI (`npm i -g artillery`) and respects `BACKEND_URL`/`TENANT`.
