🧠 Yeni Sistem Mimarisi — Synchron AI Hub (Multi-Tenant Architecture)

                      🌐 FRONTEND
                (Next.js 14 / TailAdmin)
                     │
                     ▼
       ┌─────────────────────────────────┐
       │ Tenant Dashboard & Hub UI       │
       │ - Tenant selector               │
       │ - Metrics & Charts (/hub/metrics)│
       │ - Live Agent Events (Socket.io) │
       └─────────────────────────────────┘
                     │
                     ▼
     ┌────────────────────────────────────────┐
     │ SYNCHRON BACKEND (NestJS API)          │
     │----------------------------------------│
     │  Hub-Core Layer                        │
     │   • Event Bus (Kafka / Redis Streams)  │
     │   • Context Store (hub:context:{tenant})│
     │   • Metrics / Tempo / Prometheus       │
     │----------------------------------------│
     │  External Integrations:                │
     │   • Doktor365 API                      │
     │   • OnlyChannel (Chat365 API)          │
     │   • Payment / Travel Systems           │
     │----------------------------------------│
     │  Agents Layer (preop, postop, etc.)    │
     │   • Publishes agent events to HubCore  │
     └────────────────────────────────────────┘
                     │
                     ▼
     ┌────────────────────────────────────────┐
     │ SYNCHRON AI SERVICES (Python)          │
     │----------------------------------------│
     │  Orchestrator-Svc (FastAPI)            │
     │   • Handles /hub/events per tenant     │
     │   • LangGraph + RAG + MCP orchestration│
     │----------------------------------------│
     │  AI Agents (booking, medical, etc.)    │
     │   • Each isolated by tenant context    │
     │----------------------------------------│
     │  AI Hub-Core Modules                   │
     │   • Redis Context Manager              │
     │   • Tenant Middleware                  │
     │   • Metrics Collector (Tempo + Prom)   │
     └────────────────────────────────────────┘
                     │
                     ▼
     ┌────────────────────────────────────────┐
     │ EXTERNAL SYSTEMS                       │
     │----------------------------------------│
     │ Doktor365 / Chat365 / Stripe / AWS etc │
     │ Connected through per-tenant adapters  │
     │----------------------------------------│
     │ Each request tagged with {tenant_id}   │
     └────────────────────────────────────────┘

     🌐 Synchron AI Platform – Kullanıcı Deneyimi Akışı (Gerçek Süreç)


1️⃣ Kullanıcı Girişi ve Tenant Seçimi
	•	Kullanıcı (örneğin bir klinik yöneticisi veya acente) sisteme Next.js tabanlı Dashboard üzerinden giriş yapar.
	•	Her kullanıcı bir tenant (örneğin “Doktor365”, “OnlyChannel”, “HealthTourism”) kimliğiyle ilişkilidir.
	•	Girişten sonra, kullanıcı “Tenant Selector” üzerinden hangi sistemle çalışmak istediğini seçer.
→ Örnek: “Doktor365” seçilirse sağlık kayıtları ve hasta akışları aktif olur.
→ “OnlyChannel” seçilirse mesajlaşma ve chatbot yönetimi ekranı açılır.

⸻

2️⃣ Veri Erişimi ve Hub Orkestrasyonu
	•	Kullanıcı bir işlem yaptığında (örneğin “hasta durumu sorgula” veya “mesaj gönder”),
istek Tourism Backend (NestJS) API’sine gider.
	•	Backend, isteği hub-core üzerinden işler:
	•	TenantContextInterceptor → isteğin hangi tenant’a ait olduğunu algılar.
	•	ContextStoreService → Redis üzerinde {tenant}:{service}:{key} şeklinde bir context yaratır.
	•	HubEventPublisher → isteği ilgili AI Orchestrator veya dış sistemlere gönderir.

⸻

3️⃣ AI Katmanı (Orchestrator + Agent’lar)
	•	Python Orchestrator Service, backend’ten gelen olayı alır.
	•	Olayı ilgili AI Agent’a yönlendirir:
	•	Örneğin “Pre-op Agent” ameliyat öncesi hasta bilgilerini değerlendirir,
	•	“Post-op Agent” iyileşme takibini yapar,
	•	“Security Agent” verilerin KVKK / HIPAA uyumluluğunu kontrol eder.
	•	AI sonucu tekrar hub’a gönderir.
	•	Sonuç, kullanıcının dashboard’unda anlık olarak görünür (ör. “Hasta hazır”, “Mesaj iletildi”).

⸻

4️⃣ Dış Sistemlerle Etkileşim
	•	Aynı istek gerekirse dış sistemlere de iletilir:
	•	Doktor365 API → hasta kayıtları, randevular, tedavi planı,
	•	OnlyChannel API (Chat365) → WhatsApp veya Instagram mesajları,
	•	Ödeme API’leri → Stripe / IyziPay işlemleri,
	•	Travel API’leri (Amadeus / Skyscanner) → uçuş ve konaklama sorguları.
	•	Tüm çağrılar tenant bazlı cache ve rate limit mantığıyla yönetilir.

⸻

5️⃣ Gözlemlenebilirlik (Monitoring & Metrics)
	•	Her işlem otomatik olarak Prometheus + Tempo ile ölçülür:
	•	/hub/metrics → anlık işlem sayıları, gecikmeler, hatalar.
	•	Tempo → her tenant için ayrı “trace” oluşturur (örneğin tenant=Doktor365).
	•	Grafana Dashboard üzerinden yöneticiler:
	•	Hangi tenant’ın daha yoğun çalıştığını,
	•	Hangi agent’ın daha fazla hata ürettiğini görebilir.

⸻

6️⃣ CI/CD ve Ortam Ayrımı
	•	Her tenant için ayrı bir deployment pipeline vardır:
	•	ArgoCD + Helm Chart sistemi her tenant’a özel values.{tenant}.yaml dosyalarıyla dağıtım yapar.
	•	Her ortamın (dev, staging, prod) .env dosyaları ayrıdır.
	•	Örnek:

    DOKTOR365_API_URL=https://api.doktor365.com
ONLYCHANNEL_BASE_URL=https://api.chat365.com.tr
AI_ORCHESTRATOR_URL=https://ai.synchronhub.com
PROMETHEUS_URL=https://metrics.synchronhub.com

7️⃣ Kullanıcı Deneyimi (Gerçek Zamanlı Akış)
	•	Kullanıcı dashboard’da tüm akışı canlı izler:
	•	Yeni bir hasta eklendiğinde → anında bildirim gelir.
	•	AI Agent bir öneri oluşturduğunda → dashboard güncellenir.
	•	Chat365’ten gelen mesajlar → doğrudan panelde görünür.
	•	Böylece tek bir arayüz üzerinden:
AI, Doktor365, Chat365 ve ödeme sistemleri senkron şekilde çalışır.