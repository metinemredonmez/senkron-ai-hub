# Health Tourism AI Platform Kubernetes Stack

This directory mirrors the October 2025 production footprint. Manifests are separated by namespace so platform services, AI workloads, data plane, and observability can be deployed or upgraded independently.

## Layout

- `namespaces.yaml` – creates the `backend`, `ai`, `infra`, and `monitoring` namespaces.
- `backend/` – NestJS API (`backend`) and Next.js web (`frontend`) deployments plus ingress, config map, and secrets.
- `ai/` – Orchestrator FSM and vertical AI microservices (NLP, Speech, Vision, Personalization) with dedicated config/secrets and per-service ingress.
- `infra/` – Stateful dependencies (`postgres`, `redis`, `qdrant`, `minio`) including persistent volume claims and TCP ingress endpoints.
- `monitoring/` – Prometheus, Grafana, Loki, and Tempo deployments with pre-wired provisioning config.

## Environment Materialisation

Secrets include `${VAR_NAME}` placeholders that should be rendered from `.env.prod` before applying. For example:

```bash
export $(grep -v '^#' .env.prod | xargs)
envsubst < infrastructure/kubernetes/backend/secret.yaml | kubectl apply -f -
```

Repeat for each namespace (or template using Kustomize/Helm). ConfigMaps carry non-sensitive settings and can be applied directly.

## Apply Order

```bash
kubectl apply -f infrastructure/kubernetes/namespaces.yaml
kubectl apply -f infrastructure/kubernetes/infra/
kubectl apply -f infrastructure/kubernetes/backend/
kubectl apply -f infrastructure/kubernetes/ai/
kubectl apply -f infrastructure/kubernetes/monitoring/
```

Adjust ingress hosts (`*.health-tourism.local`) to match your DNS or IngressController configuration.
