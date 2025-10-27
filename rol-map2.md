# Health Tourism AI Platform - Kapsamlı Mimari Doküman

Süper—şimdi "ben ↔️ Doktor365 ↔️ 3. taraf servisler (uçak/otel/ödeme) ↔️ AI ajanları" bütününü tek mimaride netleştirelim. Aşağıdaki kurgu, mevcut repo düzenin ve dokümanlarında tanımlı katmanlarla bire bir uyumludur; hangi modülün ne yaptığı, hangi endpoint'lerin çağrıldığı, nelerin ayrı servis olması gerektiği ve redis/kafka/s3 gibi altyapıların nerede kullanıldığı adım adım yer alır. (aşağıdaki referanslar senin docs/ içeriğinden)

**Referans Dokümanlar:** `API_REFERENCE.md`, `AGENTS.md`, `README.md`

## 0) Kuşbakışı Entegrasyon Resmi

**Akış:** `web/mobile → backend (NestJS) → orchestrator (LangGraph) → Doktor365 (CRM/klinik) + 3p travel/payments → redis/kafka → s3/minio → izleme`

Bu tam olarak docs'taki katmanlarla (UI / application / integration / ai / knowledge / data / monitoring) örtüşüyor.

```
client (web/mobile)
   │
   ▼
backend (NestJS)
   ├─ external/doctor365  ← D365 CRM/klinik API köprüsü
   ├─ external/travel     ← Amadeus/SkyScanner vb.
   ├─ external/payments   ← Stripe/iyzico (webhook + idempotency)
   ├─ ai-bridge           ← orchestrator FSM köprüsü
   ├─ docs-visa           ← MinIO presign upload / download
   ├─ cases/pricing       ← işlev modülleri
   ├─ redis               ← cache, idempotency, locks
   └─ kafka/rabbit        ← event bus (case.created, approval.required, …)
         │
         ▼
orchestrator (FastAPI + LangGraph)
   ├─ tools.d365          ← D365 çağrıları
   ├─ tools.travel        ← uçuş/otel 3p çağrıları
   ├─ tools.s3            ← presigned url, dosya varlığı
   └─ checkpoint(REDIS)   ← lg:ckpt:{caseId}
```

Docs'taki "Tourism App ↔ AI Core ↔ D365" entegrasyon modeli ve FSM akışları da aynı kurguyu gösteriyor.

## 1) Ben ↔ Doktor365 Bağının Mimarisi

### Neden ayrı modül?

Doktor365, CRM/klinik tarafındaki kaydın tek sahibi (deal, note, itinerary, vs.). Travel/otel/ödeme gibi operasyonel 3. taraf servisler ise bundan fonksiyonel olarak farklı. Bu yüzden external/doctor365 ayrı tutulmalı, 3. taraf sağlayıcılar external/travel, external/payments gibi kendi paketlerinde olmalı. (repo yapısı da bu ayrımı destekliyor)

### Backend tarafında eklenecekler

```
backend/src/modules/external/doctor365/
  ├─ doctor365.module.ts
  ├─ doctor365.controller.ts     # opsiyonel proxy; genelde service içerden çağrılır
  ├─ doctor365.service.ts        # iş mantığı + token yenileme
  ├─ doctor365.client.ts         # axios instance + retry + circuit breaker
  ├─ dto/
  │   ├─ start-tourism.dto.ts
  │   ├─ send-flight.dto.ts
  │   └─ add-note.dto.ts
  └─ mapper.ts / interfaces.ts
```

### ENV & Redis:

- `D365_BASE_URL`, `D365_CLIENT_ID`, `D365_CLIENT_SECRET`, `D365_USERNAME`, `D365_PASSWORD`
- Access token redis'te `d365:token:{tenant}` (TTL: 55dk)
- Idempotency: `idem:{sha256(key)}` (TTL: 24s – 24h; yazma uçlarında zorunlu)

Bu kalıplar API Reference / AI Services belgelerinde aynen geçiyor.

### Endpoint Eşleştirmeleri (örnek):

- **start:** `POST /patient/ai/start-tourism-agent` ← `doctor365.service.startTourismAgent()`
- **flight:** `POST /patient/ai/send-flight-data` ← `doctor365.service.sendFlightData()`
- **note:** `POST /patient/deals/note` ← `doctor365.service.addDealNote()`
- **deal:** `GET /patient/deals/{id}` ← `doctor365.service.getDeal()`

Orchestrator'da "provider_match/pricing/itinerary" düğümlerinde bu çağrılar yapılıyor (D365 sync noktaları).

### Çağrı Sözleşmesi (DTO örnekleri):

```typescript
// start-tourism.dto.ts
export class StartTourismDto {
  @IsString() dealId: string;
  @IsString() patientId: string;
  @IsOptional() @IsString() channel?: 'whatsapp'|'web'|'other';
}
```

### Resilience:

- axios-retry (3x exponential)
- circuit breaker (opossum) "d365" adıyla; open state'de hızlı fail + cache fallback
- tüm dış çağrılarda otel span label'ı: `integration_call=doctor365`

## 2) 3. Taraf Travel / Payment / Messaging Servisleri

### Neden ayrı paket?

Doktor365 = CRM/klinik; amadeus/skyscanner = OTA (flight/hotel); stripe/iyzico = ödeme. Tek bir modül altında toplanırsa bağımlılıklar karışır ve devops/anahtar yönetimi zorlaşır. Önerilen ayrım:

```
backend/src/modules/external/
  ├─ doctor365/         # CRM/klinik
  ├─ travel/            # amadeus, skyscanner (provider adapter pattern)
  ├─ payments/          # stripe, iyzico (webhook + idempotency)
  └─ comms/             # whatsapp cloud api (webhook + template send)
```

### Travel (Amadeus) örneği:

- token cache → `amadeus:token` (TTL 55m)
- circuit breaker adı: `amadeus`
- rate-limit sayacı → `rate:{tenant}:{route}`

Bu kullanım zaten docs'ta Travel ve Integrations bölümlerinde anlatılıyor.

### Payments (Stripe/Iyzico):

- webhook → `/webhooks/payments`
- imza doğrulama + X-Idempotency-Key zorunlu
- event publish: `payment.succeeded` (Kafka/Rabbit)

Event-driven topikler ve webhook kuralları API dokümanına işlendi.

### Comms (WhatsApp):

- inbound webhook → `/webhooks/whatsapp` (signature check)
- outbound template → `comms.service.sendTemplate()`
- event publish: `whatsapp.inbound` (opsiyonel)

Integrations dökümanında akış ve payload örneği var.

## 3) Orchestrator (LangGraph) ile Bağ Nerede?

### Backend ↔ Orchestrator köprüsü: ai-bridge modülü

- `POST /ai/start-case` → orchestrator `/orchestrate/start`
- `POST /ai/resume-case` → orchestrator `/orchestrate/resume`
- `GET /ai/state/:caseId` → orchestrator `/orchestrate/state/{caseId}`

**Checkpoint:** redis `lg:ckpt:{caseId}` (FSM ilerledikçe güncellenir)

Bu köprü ve ana FSM durum uçları API Reference/SURFACE'ta listeli.

### FSM düğümlerinde entegrasyon:

- **provider_match** → D365 `GET /deals` ile sağlayıcı senkronu
- **pricing** → D365 `POST /deals/note` (teklif notu)
- **itinerary** → D365 `POST /ai/send-flight-data` (kesinleşen uçuş)
- **travel** → Amadeus/SkyScanner
- **docs_visa** → MinIO presign

Agents & FSM v3 içindeki düğüm tablosu bu eşleşmeleri işaret ediyor.

## 4) Veri Sözleşmesi ve Idempotency

### Idempotency anahtarları (redis):

- yazma uçları: `idem:{sha256(key)}`
- FSM resume: `idem:resume:{caseId}`
- payment webhook: `idem:pay:{provider}:{reference}`

### Canonical redis anahtarları:

- `lg:ckpt:{caseId}` (FSM checkpoint)
- `case:state:{caseId}` (UI için özet state)
- `case:lock:{caseId}` (kısa süreli iş kilidi)

Bu v3 anahtar seti Agents & FSM belgesinde veriliyor.

### Kafka/Rabbit topic'leri:

`case.created`, `approval.required`, `payment.succeeded`, `doc.uploaded`, `quote.accepted`

Event topikleri dokümanlarda aynı isimle geçiyor.

## 5) Dosya, Saklama ve Dashboard

- **MinIO/S3:** `docs/{tenant}/{caseId}/{file}` yapısı, presign upload (15 dk) ve geçici GET URL; retention 180 gün
- **Grafana/Prometheus/Tempo/Loki:** integration latency, circuit breaker state, FSM node süreleri, idempotency hit rate gibi paneller

İzleme ve dosya politikası docs'ta detaylı.

## 6) "Ben de API Vereceğim / Mobil Uygulama Gelecek" Durumu

Senin backend product API'n üç katmanda dışarı açılabilir:

### Public App API (mobil/web client'ların kullandığı)

- `/auth`, `/patients`, `/cases`, `/pricing`, `/docs-visa`, `/travel`, `/ai/*` – hepsi JWT + X-Tenant ve rate limitli
- swagger: `/api/docs` (staging/prod'da JWT required moduna alınması önerilir)

### Partner API (klinike/ajanslara):

- webhooks + API key + scope (örn. sadece `GET /cases/:id`, `POST /cases/:id/notes`)

### Internal Service API (orchestrator, internal tools):

- ai-bridge ve external/* altındaki servisler; IP allow-list + mTLS önerilir

Ana README ve API Surface bu yüzeyin özetini veriyor; staging/prod'da Swagger'a auth bağlama notu da var.

## 7) 3. Taraflar Ayrı Servis mi, Tek Yerde mi?

- **CRM/klinik (D365)** → ayrı modül: `external/doctor365`
- **OTA/travel (Amadeus, SkyScanner)** → ayrı modül: `external/travel` (altında provider adapter pattern: `amadeus.adapter.ts`, `skyscanner.adapter.ts`)
- **Ödeme** → ayrı modül: `external/payments` (webhook & idempotency)
- **Mesajlaşma** → ayrı modül: `external/comms` (whatsapp)

Bu ayrım, test edilebilirlik, anahtar yönetimi ve devops dağıtımı için en güvenlisi; monorepo düzenin de bunu destekliyor.

## 8) AI Ajanlarının Rolü (Nerede Devreye Girer?)

LangGraph FSM içinde "node"'lar ajanların çağrıldığı yerdir:

- **intake/eligibility** → NLP/RAG çağrıları (Qdrant + LangChain)
- **provider_match/pricing/itinerary** → D365 tool + gerekirse travel tool
- **travel** → Amadeus/SkyScanner tool
- **docs_visa** → S3/MinIO tool (presign)
- **aftercare** → personalization + whatsapp template

**Ajanların görevi:** girdi normalizasyonu, bağlamsal öneri, uygun eylem aracını çağırma, sonuçları güvenli formatta üretme.
Her çıktı: non-diagnostic + PHI redaksiyon.

## 9) Güvenlik / Uyumluluk

- JWT + RBAC/ABAC, KVKK/GDPR (consent logs), AES-GCM alan şifreleme
- Idempotent webhooks tüm POST/PATCH uçlarında zorunlu
- Rate limit: tenant + ip bazlı

Bu güvenlik matrisi docs'ta standart hale getirildi.

## 10) Uygulama Sırası (1–2 Haftalık Sprint Planı)

1. `external/doctor365` modülü (client+service+token cache+retry+cb)
2. ai-bridge'de start/resume/state uçlarını bağla; cases'te FSM state/timeline'ı cache'le
3. `external/travel` (amadeus adapter); sonra payments webhook'ları
4. comms (whatsapp) inbound/outbound + template kütüphanesi
5. observability metrikleri (integration_call, fsm_transition, idempotency_hits) panellere bağla
6. partner api scope'ları + API key altyapısı

## 11) Hızlı Doğrulama Komutları

```bash
# postgres + redis
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

# backend
cd backend && yarn start:dev

# health (tenant header ile)
curl -H 'X-Tenant: clinic-001' http://localhost:4000/api/health

# d365 start tourism (proxy örneği; kendi servisinden içerden çağır)
curl -H 'Authorization: Bearer <jwt>' -H 'X-Tenant: clinic-001' \
     -X POST http://localhost:4000/api/external/d365/start-tourism \
     -d '{ "dealId": "D365-123", "patientId": "P-555" }'
```

## Sonuç

- Senin backend, D365 ile CRM/klinik katmanında konuşur; travel/ödeme/mesajlaşma ayrı provider modülleridir.
- Orchestrator FSM düğümlerinde bu servisleri araç (tool) olarak çağırır, redis checkpoint ile ilerler, kafka ile olay yayar.
- Böylece dashboard (Grafana) ve partner/public API katmanları stabil kalır.
- Mevcut README/ARCHITECTURE/API referanslarıyla bire bir uyumlu şema; mermaid ve tablo görselleri de aynı ilişkileri göstermekte.

Hazırsan, external/doctor365 için kod iskeletini (service + client + dto + module) hazır prompt ile Codex'e göndereyim.