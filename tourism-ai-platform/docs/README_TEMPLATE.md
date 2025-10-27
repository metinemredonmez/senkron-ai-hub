# 🧩 [Module Name]
> Describe module purpose within Synchron AI Hub (1–2 sentences).

---

## 🧭 Overview
Explain what this service/module does in 3–5 lines.

---

## 🧠 Tenant Awareness
- Describe how tenant isolation works.
- Example Redis key: `{tenant}:{service}:{key}`
- Header: `X-Tenant: {tenantId}`

---

## 🔗 Connections
| Service | Protocol | Purpose |
|----------|-----------|----------|
| Redis | TCP | Tenant cache |
| Kafka | TCP | Event streaming |
| Tempo / Prometheus | HTTP | Observability |
| External APIs | HTTPS | Doctor365, OnlyChannel |

---

## ⚙️ Deployment
### Environment Variables
| Variable | Description | Example | Required |
|-----------|--------------|----------|-----------|
| DATABASE_URL | Postgres connection string | postgresql://user:pass@db:5432/db | ✅ |
| HUB_REGISTRY_URL | Hub Core agent registry URL | http://backend:4000/api/hub/agents | ✅ |
| PROMETHEUS_PUSHGATEWAY_URL | Prometheus Pushgateway endpoint | http://prometheus:9091 | ✅ |
| TEMPO_ENDPOINT | Tempo tracing endpoint | http://tempo:4318 | ✅ |
| DOKTOR365_SECRET | Doktor365 API signing secret | *** | ✅ |
| ONLYCHANNEL_ACCOUNT_TOKEN | Chat365 token | ak_xxx | ✅ |

---

## 📊 Metrics & Observability
- `/metrics` and `/hub/metrics` endpoints exposed for Prometheus scraping.  
- Tempo spans include `tenant_id` and `service` labels.  
- Grafana dashboards: `monitoring/grafana/`

---

## 🔄 CI/CD
- Validated by `.github/workflows/tenant-validation.yml`
- Deployment handled via ArgoCD Helm values per tenant.

---

## 🧪 Example Usage
```bash
# Test health
curl http://localhost:4000/api/health

# Test tenant metrics
curl http://localhost:4000/hub/metrics

# Test Redis keys
redis-cli KEYS "*{tenant}:*"
```
