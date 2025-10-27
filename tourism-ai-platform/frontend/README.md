# Frontend (`@tourism/frontend`)

## Overview
The Next.js 14 web client delivers the Synchron AI Hub operator and patient portals. It consumes backend `/api` routes, surfaces orchestration status from HubCore, and renders tenant-branded experiences. Architectural context is documented in [Architecture](../docs/ARCHITECTURE.md) and deployment steps in [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md).

## Tenant Awareness
- Axios interceptors automatically inject the `X-Tenant` header on every request, ensuring backend controllers resolve the correct tenant context.
- The UI stores tenant metadata (branding, locale) fetched from `/api/tenants` and scopes caches using keys such as `{tenantId}:ui:preferences`.
- Server Actions read the tenant from cookies/session to isolate SSR data fetching and prevent cross-tenant leakage.

## Connections
| Dependency | Purpose | Usage |
|------------|---------|-------|
| **Backend API** | REST + Hub endpoints (`/api/*`, `/hub/events`) | Data fetching, messaging, orchestration status |
| **WebSockets / SSE** | Real-time updates from backend (where enabled) | Live conversation feeds |
| **Grafana / Observability** | Deep links for tenant dashboards | `NEXT_PUBLIC_GRAFANA_URL` integration |
| **OnlyChannel** | Embed conversation threads for operators | Through backend proxied APIs |

## Deployment
- Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TENANT`, `NEXT_PUBLIC_FEATURE_*`, `NEXT_PUBLIC_GRAFANA_URL`.
- For Kubernetes, use manifests in `infrastructure/kubernetes/frontend/`; configure ingress to terminate TLS and forward `/` to the Next.js service.
- CI/CD bundles the frontend in the same release as backend/orchestrator via ArgoCD applications.
- CDN or edge caching should respect tenant-specific routes (`/{tenant}/...`) and avoid caching authenticated responses.

## Metrics & Observability
- Client web vitals can be forwarded to Prometheus pushgateway or backend `/api/metrics` endpoints.
- Tempo correlation is achieved by propagating request IDs in headers like `X-Request-Id`.
- Logging hooks send structured entries to Loki (via backend proxies) with `tenant` metadata for filtering.

## CI/CD
- `ci-backend.yml` runs linting (`yarn lint`, `yarn type-check`) as part of the monorepo pipeline.
- `tenant-validation.yml` exercises key user flows through API smoke tests once the frontend is built.
- `deploy-staging.yml` / `deploy-production.yml` build the Next.js image and roll it out via ArgoCD.

## Examples
### `.env.local`
```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_TENANT=chat365
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3001/d/chat365/hub
NEXT_PUBLIC_FEATURE_ORCHESTRATOR_INSIGHTS=true
```

### Trigger Hub Event
```bash
curl -X POST http://localhost:4000/api/hub/events \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant: chat365' \
  -d '{"id":"evt-frontend","tenantId":"chat365","type":"ui.action","source":"frontend","timestamp":"2024-04-01T12:00:00Z","payload":{"action":"refreshDashboard"}}'
```

### Redis Key Patterns
- `chat365:ui:feature-flags` – Cached feature toggle state fetched during SSR.
- `chat365:onlychannel:token` – Backend-managed token used by UI calls.
- `chat365:hub:session:{sessionId}` – Session transcript rendered in the UI conversation view.
