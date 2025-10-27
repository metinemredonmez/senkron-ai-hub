# 🗺 Roadmap – Version 2.1 (December 2025)

The roadmap describes the continuous evolution of the **Health Tourism AI Platform** — from MVP delivery to enterprise-grade orchestration — aligned with the mission: secure, observable, event-driven, and compliant health-tourism automation.

---

## 🧩 12-Week MVP Implementation Plan

| Week | Milestone | Core Deliverables |
|------|------------|------------------|
| **1 – 2** | Architecture Freeze + Security Bootstrap | Tenant model finalization • RBAC + ABAC (CASL) • Postgres RLS • JWT / AES-GCM encryption setup |
| **3 – 4** | Patient & Case Flow | Intake wizard (Next.js) • Case API + FSM bridge • Redis checkpoint • Audit log schema |
| **5 – 6** | Core Modules | Pricing + Travel • Quote composer • MinIO document uploads • Kafka/Rabbit queues |
| **7 – 8** | Operations Layer | Ops Console approvals • WhatsApp webhook • Payment callbacks (idempotent middleware) |
| **9 – 10** | AI Layer | LangGraph FSM • RAG (Qdrant + embeddings) • Vision / Speech microservices • Grafana LLM dashboards |
| **11** | Testing & Observability | Playwright E2E • Expo mobile smoke tests • Sentry error tracking • Prometheus metrics |
| **12** | Pre-Production Review | Load testing • KVKK/GDPR audit • Staging go-live checklist |

---

## 🚀 6–12 Month Scale Plan

### **Quarter 1 – Secure Integration**
- 🔐 Deploy **Doktor365 proxy module** with idempotency middleware + token cache.  
- ⚙️ Migrate configuration to **Vault / AWS Secrets Manager**.  
- 🧠 Enable LangGraph FSM telemetry + Redis checkpoint metrics.  
- ⚖️ Implement autoscaling (HPA) on EKS with Terraform.  
- 🧾 Activate E-Invoice and payment webhook pipelines.  

---

### **Quarter 2 – Intelligent Analytics**
- 📊 Launch **Journey Analytics Dashboard** (conversion & drop-off rates).  
- 🔄 Adopt **Kafka topics** `case.*`, `docs.*`, `payment.*` with DLQ and retry policy.  
- 🧮 Integrate Grafana SLO panels for API latency and queue lag.  
- 🧩 Extend HealthTürkiye (USHAŞ) catalog sync for provider registry.  
- 🧺 Apply S3 lifecycle policies for 365-day archival compliance.  

---

### **Quarter 3 – Partner Ecosystem**
- 🤝 Deploy **B2B Partner API Layer** (API keys, scopes, rate limits).  
- 🧠 Implement AI feedback loop for Vision and RAG evaluation.  
- 📱 Enable push notifications + offline itinerary cache in mobile app.  
- 🧩 Add rule-based clinical coordination engine (non-diagnostic).  
- 🛡️ Introduce Geo/MFA policies for operators.  

---

### **Quarter 4 – Enterprise Readiness**
- 🏗 Multi-region replication (Postgres + Redis + Qdrant).  
- 🔍 Centralized **SIEM** (Grafana Cloud / DataDog).  
- 🧩 Fine-grained IAM (Keycloak / Cognito).  
- 🌐 AI-Assisted Travel Concierge (18 languages + real-time LLM routing).  
- 🧠 Deploy **GraphRAG** for semantic reasoning across medical + travel domains.  
- 📊 Annual **Compliance Reports** (GDPR / KVKK / SOC 2).  

---

## 📅 Long-Term Vision (24-Month Evolution)

| Pillar | Objective | Outcome |
|--------|------------|----------|
| **AI Orchestration** | Self-adaptive LangGraph FSM | Context-aware agent handoffs with audit memory |
| **Interoperability** | Full FHIR / DICOM / HL7 compliance | Cross-border data exchange for clinics |
| **Data Governance** | Immutable audit + anonymized lake | Complete traceability for ML datasets |
| **Personalization** | Empathy-aware AI journey assistant | Dynamic UX guidance for patients |
| **Ecosystem Integration** | Nationwide USHAŞ / OTA sync | Unified health-tourism ecosystem interoperability |

---

## ✅ Milestone Verification & KPIs

| Category | KPI | Target |
|-----------|-----|--------|
| **System Health** | Uptime | ≥ 99.9 % (SLO monitored via Prometheus) |
| **Performance** | p95 API latency | < 250 ms (Grafana panels) |
| **Queue Reliability** | DLQ rate | < 1 % |
| **Idempotency** | Success rate | > 99.5 % |
| **AI Reliability** | Hallucination rate | < 3 % (LangSmith) |
| **Compliance** | KVKK / GDPR audit pass | Annual external review |
| **Ops Efficiency** | Approval resolution time | < 4 h (Redis queue metrics) |
| **Security** | Open CVE count | 0 (Monthly scan) |

---

**Maintained by:** PMO & DevOps Team  
**Version:** 2.1 — Health Tourism AI Platform  
**Last Updated:** December 2025

u sürüm:
	•	🔄 Architecture Integration v3’teki tüm güvenlik, observability ve queue güncellemelerini içeriyor.
	•	🔐 Doktor365 proxy ve idempotency middleware artık resmi yol haritasında yer alıyor.
	•	📊 KPI’lar genişletildi (Queue / Idempotency / AI Reliability).