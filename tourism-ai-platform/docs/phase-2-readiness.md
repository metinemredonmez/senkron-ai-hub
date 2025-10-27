# Phase 2 Readiness Runbook

## Database & Seed
1. `yarn workspace @tourism/backend run typeorm migration:run`
2. `yarn workspace tools run db-seed`

## Smoke Tests
1. `bash tools/smoke/backend-health.sh`
2. `bash tools/smoke/orchestrator-health.sh`
3. `curl -sf -H 'X-Tenant: system' http://localhost:4000/api/cases`

## Observability Validation
1. Prometheus: open `http://localhost:9090`, query `hub_agent_latency_seconds`.
2. Grafana: verify dashboards load tenant filters.
3. Tempo: open `http://localhost:4318` via Grafana Explore and confirm traces tagged with `tenant_id`.
