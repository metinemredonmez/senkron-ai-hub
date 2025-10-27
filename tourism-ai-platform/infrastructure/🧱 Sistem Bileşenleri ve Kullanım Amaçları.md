# 🧱 Sistem Bileşenleri ve Kullanım Amaçları

## Ana Bileşenler

| Bileşen | Kullanım Amacı | Nerede Kullanılıyor | Neden Gerekli |
|---------|---------------|---------------------|---------------|
| **PostgreSQL** | Kalıcı veri tabanı (users, tenants, cases, logs, payments, vs.) | `backend/src/database` | İşlem geçmişi, tenant kayıtları ve AI karar sonuçları gibi verilerin kalıcı saklanması için. |
| **Redis** | Cache + Context Store + Idempotency + Rate-limit | `backend/src/lib/nestjs-redis/redis.service.ts`, `hub-core/context-store.service.ts` | Saniyede binlerce istek için hızlı veri erişimi, tekrarlanan POST işlemlerini engelleme, tenant context yönetimi. |
| **Kafka** | Event Bus (asenkron iletişim) | `hub-core/services/event-bus.service.ts`, `ai-services/orchestrator-svc/app/services/event_bus.py` | Backend ↔ AI Orchestrator ↔ Agents arasında olay tabanlı veri aktarımı sağlar (event-driven architecture). |
| **RabbitMQ** | Alternatif mesaj kuyruğu (opsiyonel) | `infrastructure/docker/docker-compose.yml` | Uzun süren işlemler için (ör. dosya işleme, email gönderimi) job queue olarak kullanılabilir. |
| **Prometheus** | Metrik toplama (telemetri) | `monitoring/prometheus/prometheus.yml`, `/hub/metrics` endpoint | Backend, Orchestrator ve Agent performans metriklerini toplar (örn. response time, error rate). |
| **Grafana** | Görselleştirme (dashboard) | `monitoring/grafana` | Prometheus ve Tempo verilerini dashboard üzerinden izleme. Tenant bazlı filtreleme yapılabiliyor. |
| **Tempo** | Trace toplama (distributed tracing) | `backend/src/hub-core/services/telemetry-sync.service.ts` | AI zincirindeki tüm işlemlerin (Backend → Orchestrator → Agent) uçtan uca izlenebilmesi için. |
| **Loki** | Log toplayıcı | `monitoring/loki` | Backend ve AI servislerinden gelen logları merkezi depoda saklar. |
| **MinIO / S3** | Dosya depolama (belge, görüntü, fatura, vs.) | `infrastructure/docker/minio` | Doküman yükleme, hasta raporu veya AI analiz çıktılarının güvenli depolanması için. |
| **OnlyChannel (Chat365)** | Mesajlaşma / müşteri iletişimi API'si | `backend/src/modules/external/only-channel/` | WhatsApp, Instagram gibi kanallar üzerinden kullanıcı mesajlarını alıp yönlendirmek için. |
| **Doktor365 API** | Hasta / tedavi yönetim API'si | `backend/src/modules/external/doctor365/` | Hasta bilgilerini, randevu ve tedavi planlarını almak/güncellemek için. |
| **FastAPI (Python)** | AI Orchestrator servisi | `ai-services/orchestrator-svc` | LangGraph FSM ile karar motorunu çalıştırır, backend'ten gelen olayları işler. |
| **LangGraph FSM** | AI Akış Mantığı (workflow engine) | `ai-services/orchestrator-svc/app/graph` | "Case created" veya "Travel planned" gibi süreçleri adım adım yöneten FSM yapısı. |
| **CrewAI / AutoGen** | Multi-agent AI framework (opsiyonel) | `ai-services/agents` | Her tenant için farklı uzman (agent) modellerini çalıştırmak için. |
| **OpenTelemetry (OTEL)** | İzleme standardı | `backend/src/common/telemetry/opentelemetry.ts` | Prometheus, Tempo ve Grafana'ya tek bir telemetri standardı üzerinden veri gönderir. |
| **ArgoCD / Helm / Terraform** | CI/CD & Infrastructure Automation | `infrastructure/terraform`, `.github/workflows` | Deployment otomasyonu ve infrastructure yönetimi. |

---

## 🧠 Bağımlılık Zinciri (Akış Mantığı)

```
Frontend (Next.js)
    ↓
Backend (NestJS)
    ↳ Redis (cache + context)
    ↳ Kafka (event dispatch)
    ↳ Doktor365 / OnlyChannel / Payments
    ↳ Prometheus & Tempo (telemetry)
    ↓
AI Orchestrator (FastAPI)
    ↳ Redis (tenant context)
    ↳ Kafka (event receive)
    ↳ LangGraph FSM (AI workflow)
    ↓
AI Agents (Pre-op, Post-op, Security)
    ↳ Tempo (tracing)
    ↓
Monitoring Stack
    ↳ Prometheus / Grafana / Loki / Tempo
```

---

## 🧾 Gerekli Olan Minimum Servisler (Lokal Geliştirme İçin)

| Servis | Gerekli mi? | Docker'da ayağa kalkmalı mı? |
|--------|------------|----------------------------|
| **PostgreSQL** | ✅ Zorunlu | Evet |
| **Redis** | ✅ Zorunlu | Evet |
| **Kafka** | ✅ Zorunlu | Evet |
| **Prometheus + Grafana** | ⚙️ Opsiyonel (gözlem için) | Evet |
| **Tempo** | ⚙️ Opsiyonel (trace için) | Evet |
| **Loki** | ⚙️ Opsiyonel (loglama için) | Evet |
| **RabbitMQ** | ❌ Opsiyonel | Hayır |
| **MinIO** | ⚙️ Opsiyonel (dosya için) | İsteğe bağlı |

---

## 📝 Notlar

- **Zorunlu servisler**: PostgreSQL, Redis ve Kafka olmadan sistem çalışmaz.
- **İzleme servisleri**: Prometheus, Grafana, Tempo ve Loki production ortamında şiddetle tavsiye edilir.
- **MinIO**: Dosya yükleme özelliği kullanılacaksa gereklidir.
- **RabbitMQ**: Arka plan işleri için opsiyonel bir alternatif sunuyor.
