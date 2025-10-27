# 🚀 Deployment Guide — Health Tourism AI Platform (Production Readiness)

Version 3.1 — October 2025

This guide covers local/Docker workflows, staging Kubernetes rollout, and the observability validation required for the final production release.

---

## Environments at a Glance

| Environment | Purpose | Tooling | Secrets |
|-------------|---------|---------|---------|
| Local | Developer sandbox with full observability | Docker Compose, `.env.local` | `.env.local`, Git-ignored |
| Staging | QA & integration testing | Kubernetes (EKS/GKE) + GitOps/ArgoCD | External Secrets (Vault/SSM) |
| Production | Customer traffic, multi-region | Terraform + Kubernetes | Vault / AWS Secrets Manager |

---

## 1. Local Deployment (Docker Compose)

```bash
cd infrastructure/docker
docker compose up -d postgres redis redis-exporter postgres-exporter \
  zookeeper kafka qdrant minio loki tempo prometheus grafana
```

Key notes:
- `prometheus` service now includes `extra_hosts: ["host.docker.internal:host-gateway"]` so it can scrape the host-exposed backend at `http://host.docker.internal:4000/metrics`.
- Redis metrics are surfaced via `redis-exporter` (port **9121**) and Postgres metrics via `postgres-exporter` (port **9187**).
- Backend metrics require the NestJS app to be running locally on port 4000 with `/metrics` enabled (see `backend/src/modules/metrics`).

### Manual Validation (Run Individually)

```bash
# Application health
curl -s http://localhost:4000/api/health
curl -s http://localhost:8080/health

# Metrics targets
curl -s http://localhost:4000/metrics | head -n 5
curl -s http://localhost:9121/metrics | head -n 5
curl -s http://localhost:9187/metrics | head -n 5
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets'

# Logs & traces
curl -s http://localhost:3100/ready
curl -s http://localhost:4318/metrics | head -n 5
```

Grafana dashboards (http://localhost:3001):
- **Infrastructure Health** – exporter status, resource saturation
- **Backend Service** – latency, error rates, per-route metrics
- **AI Orchestrator** – workflow timings, approvals, retries
- **Tracing Overview** – Tempo Explore with filters `service.name="health-tourism-backend"` / `ai.case.id`

---

## 2. Staging Deployment (Kubernetes)

> **Prerequisite:** kubeconfig must contain the staging cluster + user credentials.

```bash
# Configure context (requires permissions on ~/.kube/config)
kubectl config set-context staging \
  --cluster=<cluster_name> \
  --namespace=tourism \
  --user=<staging_user>
kubectl config use-context staging

# Apply all manifests (namespaces, infra, workloads, monitoring)
kubectl apply -f infrastructure/kubernetes/

# Verify workload status
kubectl get pods -A | grep tourism
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

If direct access to Prometheus/Grafana is required:

```bash
kubectl port-forward -n monitoring svc/prometheus 9090:80
kubectl port-forward -n monitoring svc/grafana 3001:80
```

### Staging Validation Commands

```bash
kubectl run curl --rm -it --image=curlimages/curl -n backend \
  -- curl -s http://backend.backend.svc.cluster.local:4000/api/health

kubectl run curl --rm -it --image=curlimages/curl -n monitoring \
  -- curl -s http://prometheus.monitoring.svc.cluster.local/api/v1/targets

kubectl logs -n monitoring deploy/loki -f    # Loki ingestion
kubectl logs -n monitoring deploy/tempo -f   # Tempo ingestion
```

---

## 3. Production Considerations

- **Terraform** provisions VPC, Kubernetes clusters, RDS Postgres, ElastiCache Redis, S3 buckets, IAM roles, Route53 DNS, ACM TLS.
- **Secrets** managed via Vault or AWS Secrets Manager and synced by External Secrets Operator.
- **Scaling**: HPA for backend (CPU 60%), orchestrator (CPU 55%), bridge (CPU 45%), AI services (GPU optional). Prometheus/Grafana deployed as StatefulSets with persistent storage.
- **Backups**: PostgreSQL WAL archiving, Redis snapshots to S3, MinIO bucket replication.
- **Disaster Recovery**: Multi-region Terraform workspace + database replicas.

---

## 4. Security & Configuration Checklist

- AES-256-GCM field encryption enabled (`FIELD_ENCRYPTION_KEY`).
- Rate limiting TTL counters stored at `rate:{tenant}:{route}`.
- Idempotency lock keys hashed (`idem:{sha256(tenant:key)}`) with 5-minute TTL.
- Kafka topics `events.workflow.*` and `security.*` retained for 14 days.
- External secrets synced to Kubernetes namespaces (`backend`, `ai`, `monitoring`).

---

## 5. Verification Matrix

| Component | Local Validation | Staging Validation |
|-----------|-----------------|--------------------|
| Backend Metrics | `curl http://localhost:4000/metrics` | `kubectl port-forward backend 4000` + curl |
| Redis Exporter | `curl http://localhost:9121/metrics` | `kubectl run curl ... redis-exporter.monitoring` |
| Postgres Exporter | `curl http://localhost:9187/metrics` | same via port-forward |
| Prometheus Targets | `curl http://localhost:9090/api/v1/targets` | `kubectl port-forward svc/prometheus` |
| Grafana Dashboards | http://localhost:3001 | `kubectl port-forward svc/grafana` |
| Loki / Tempo | `curl http://localhost:3100/ready` / `curl http://localhost:4318/metrics` | `kubectl logs deploy/loki`, `kubectl logs deploy/tempo` |

---

## 6. Release Checklist

- [ ] Docker exporters (`redis-exporter`, `postgres-exporter`) running and scraped.
- [ ] Backend `/metrics` reachable from Prometheus (`host-gateway` mapping).
- [ ] Grafana dashboards refreshed and Tempo traces visible.
- [ ] Staging context set and manifests applied (`kubectl apply -f infrastructure/kubernetes/`).
- [ ] Documentation updated (`README`, `ARCHITECTURE`, `SECURITY_COMPLIANCE`, `MONITORING`, `DEPLOYMENT`).
- [ ] Manual validation commands executed (record outputs for release notes).

Once all boxes are checked, tag the release (e.g., `v3.1.0`) and push Helm/manifest updates through the GitOps pipeline.
