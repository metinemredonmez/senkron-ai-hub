# Synchron AI Platform – Infrastructure & Environment Audit

_Last updated: 2024-10-23_

## A. Environment Inventory & Mapping

| Variable | Root `.env.local` | Root `.env.prod` | Backend `.env.local` | Backend `.env.prod`† | Infra `.env.local` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | — | — | ✅ | ✅ | — | Local backend points to `localhost`; Docker injects service URL via compose defaults. |
| `REDIS_URL` | — | — | ✅ | ✅ | — | Docker defaults to `redis://redis:6379/0`. |
| `JWT_SECRET` | — | — | ✅ | ✅ | — | Compose injects `BACKEND_JWT_SECRET` fallback. |
| `FIELD_ENCRYPTION_KEY` | — | — | ✅ | ✅ | — | Base64 placeholder kept; rotate per tenant. |
| `AI_ORCHESTRATOR_URL` | — | — | ✅ | ✅ | — | Docker stack overrides to service DNS. |
| `PROMETHEUS_PUSHGATEWAY_URL` | ⛔️ (blank) | https://prometheus.healthtourism.ai | ⛔️ (blank) | ✅ | ✅ | Only injected inside Docker/production. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | ⛔️ (blank) | https://tempo.healthtourism.ai/v1/traces | ⛔️ (blank) | ✅ | ✅ | Local host run skips OTLP to avoid ECONNREFUSED. |
| `TEMPO_ENDPOINT` | ⛔️ (blank) | https://tempo.healthtourism.ai | ⛔️ (blank) | ✅ | ✅ | |
| `S3_*` | — | — | ✅ | ✅ | — | Removed from root; sourced per backend env. |
| `POSTGRES_*` | ✅ | ✅ | — | ✅ | ✅ | Added to root local for compose parity. |
| `AWS_*` | ✅ | ✅ | — | — | ✅ | Infrastructure-only context. |
| `HUB_REGISTRY_URL` | — | — | ✅ | ✅ | — | Compose ensures service DNS. |

† `.env.prod` files remain ignored by Git; the production template now lives in `backend/.env.prod` (local-only) to keep secrets out of the root scope.

### Notable findings

- Extra env templates exist under `ai-services/**` and `mobile/**`; they currently contain only examples.
- Root `.env.local` previously included Tempo/Prometheus URLs, causing unwanted local telemetry attempts. They are now blank and gated by Docker defaults.
- Root `.env.prod` held backend secrets; it now only contains deployment metadata (AWS/K8s/observability), while backend production values moved to `backend/.env.prod` (ignored by Git).
- Backend `.env.local` already held the critical keys (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `HUB_REGISTRY_URL`) required for local development.

## B. Docker Compose & Infrastructure

- `infrastructure/docker/docker-compose.yml`
  - Added explicit `env_file` chain so the backend service reads backend-specific env templates first.
  - Injects `DATABASE_URL`, `REDIS_URL`, and security secrets with Docker-safe defaults (`postgres`, `redis`, `minio` containers).
  - Postgres container now sets `POSTGRES_USER/PASSWORD/DB` to match backend expectations; exporter DSN aligned.
  - Tempo (4318) and Prometheus (9091) endpoints are injected only within Docker via `environment` defaults—host `.env` files leave them blank.
- Health checks remain aligned with exposed ports (Postgres, Redis, backend, frontend, tempo, etc.).

## C. Backend Build & Telemetry

- `tsconfig.json` stays on `"module": "commonjs"` with Node resolution (`moduleResolution: "node"`).
- `ConfigModule.forRoot` already respects `.env.local` → `.env.prod` → `.env.example` precedence (`src/app.module.ts`).
- TypeORM uses `database.url` and falls back to discrete host/port for override scenarios.
- Telemetry guard updated (`src/common/telemetry/opentelemetry.ts`) to skip OpenTelemetry initialisation when `NODE_ENV` is local/dev and no `DOCKER` flag is present. This ends ECONNREFUSED noise during host-only runs.
- `TelemetrySyncService` continues to respect `otel.enabled`; since local `.env` leaves endpoints blank and OTEL disabled, no push attempts occur.
- Swagger already exposed at `/api/docs` and `/api/docs-json`; smoke tests assert both.

## D. Yarn Workspaces & Dependencies

- Root workspaces: `backend`, `frontend`, `mobile`, `shared` (the `tools` and `ai-services` entries in `package.json` can remain but are non-Node projects).
- Single authoritative `yarn.lock` at repo root; no stray locks inside workspaces.
- Detected version divergence: root depends on ESLint 9.x while workspaces pin 8.57.x (Nest lint config). Recommend staying on 8.x across the board until all configs support 9.x.
- Added `scripts/setup.sh` + root `yarn setup` to clean caches, install dependencies for root/backend/frontend, and print follow-up steps.

## E. Monitoring & Testing Assets

- `tools/check-health.sh` – curl + jq smoke probe for `/api/health` and `/api/docs-json`.
- `tools/smoke.http` – REST Client collection with placeholders for tenant, credentials, and JWT.
- `backend/test/smoke.e2e-spec.ts` – supertest-based smoke tests that hit a running backend (optionally logs in when credentials provided via env).
- `tools/artillery.smoke.yml` – optional Artillery scenario (requires `artillery` CLI).
- `yarn smoke:backend` and `yarn smoke:artillery` wired in root `package.json`.

## F. Recommended Follow-ups

1. **Secrets management** – move production secrets (`PROD_*`) to Vault/Secrets Manager and inject via CI/CD rather than keeping placeholders locally.
2. **Align ESLint toolchain** – consider pinning root ESLint tooling to 8.x or incrementing workspace configs in lockstep to 9.x.
3. **Workspace coverage** – add `package.json` scaffolding for `tools/` if shared TS utilities are expected; otherwise remove from `workspaces` list to avoid Yarn warnings.
4. **Telemetry toggles** – document `DOCKER=1` usage in developer docs for forcing OTLP from host machines when desired.
