# 🧭 API Surface — Health Tourism AI Platform (Version 2.1 / October 2025)

High-level API surface overview for the Health Tourism AI Platform.  
This index lists major resources, their methods, and integration endpoints.

---

## 🧱 Overview

| Key | Description |
|-----|--------------|
| **Base URL** | `/api` |
| **Versioning** | Semantic (e.g., `/api/v1/patients`) |
| **Authentication** | JWT Bearer; tenant resolved via `X-Tenant` header |
| **Idempotency** | Endpoints supporting write ops require `X-Idempotency-Key` |
| **Error Model** | JSON `{ "statusCode": number, "message": string, "traceId": string }` |
| **Docs** | Swagger at `/api/docs` |
| **Metrics** | `/metrics` Prometheus endpoint |
| **Health** | `/api/health`, `/health/live`, `/health/ready` |

---

## 🔐 Authentication

| Method | Endpoint | Notes |
|--------|-----------|-------|
| `POST /auth/login` | Authenticate user; returns access + refresh tokens |
| `POST /auth/refresh` | Exchange refresh token |
| `GET /auth/me` | Get current user info |
| `POST /auth/logout` | Invalidate session |
| `POST /auth/register` | Register new operator/clinic |
| `POST /auth/forgot-password` | Send reset link |
| `POST /auth/reset-password` | Reset password with token |

---

## 👥 Patients

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET /patients` | List patients (paginated; PII masked) |
| `POST /patients` | Create new patient (AES-GCM encryption for PII) |
| `GET /patients/:id` | Retrieve detailed patient info + linked cases |
| `PATCH /patients/:id` | Update patient data |
| `DELETE /patients/:id` | Soft delete (anonymized) |
| `POST /patients/:id/consent` | Record patient consent |
| `GET /patients/:id/history` | Fetch full patient history |

---

## 💼 Cases (FSM Integrated)

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET /cases` | List all cases with current FSM stage |
| `POST /cases` | Create new case + start orchestrator (requires Idempotency-Key) |
| `GET /cases/:id` | Fetch full case details |
| `PATCH /cases/:id` | Update case stage |
| `POST /cases/:caseId/approvals/:taskId` | Resolve approval (Ops Console action) |
| `GET /cases/:id/timeline` | Retrieve event timeline |
| `POST /cases/:id/notes` | Add case note |

FSM-integrated endpoints:
- `/ai/start-case` → Start orchestration  
- `/ai/resume-case` → Resume after human approval  
- `/ai/state/:caseId` → Get FSM state snapshot  
- `/ai/get-checkpoint/:caseId` → Retrieve Redis checkpoint  

---

## 💰 Pricing

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST /pricing/quote` | Generate treatment + travel quote |
| `GET /pricing/:id` | Get quote by ID |
| `PATCH /pricing/:id/accept` | Accept quote |
| `PATCH /pricing/:id/reject` | Reject quote |
| `POST /pricing/:id/negotiate` | Negotiate prices |

---

## ✈️ Travel

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET /travel/flights` | Retrieve flights (Amadeus sandbox) |
| `GET /travel/hotels` | Retrieve hotels |
| `POST /travel/book` | Book travel itinerary |
| `GET /travel/itinerary/:caseId` | Get itinerary (PDF/ICS) |
| `POST /travel/cancel` | Cancel trip |

---

## 📑 Docs & Visa

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET /docs/presign` | Generate presigned upload URL |
| `POST /docs/upload` | Register uploaded file |
| `GET /docs/status/:caseId` | Check required documents |
| `DELETE /docs/:id` | Delete uploaded file |
| `GET /docs/:id/download` | Download file (temporary presigned URL) |

---

## 🤖 AI Bridge

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST /ai/orchestrate` | Trigger orchestrator FSM |
| `POST /ai/resume-case` | Resume orchestration after approval |
| `GET /ai/state/:caseId` | Retrieve current FSM state |
| `POST /ai/rag/query` | Query AI-NLP service (Qdrant vector search) |
| `POST /ai/speech/tts` | Request TTS synthesis |
| `POST /ai/vision/pre-eval` | Vision-based educational summary |
| `POST /ai/personalization/recommend` | Generate patient journey hints |

---

## 🌍 External Integrations (Doktor365 Proxy)

| Method | Endpoint | Maps To | Description |
|--------|-----------|---------|-------------|
| `GET /external/d365/deals/:id` | `/patient/deals/{id}` | Fetch deal info |
| `POST /external/d365/deals/:id/notes` | `/patient/deals/note` | Add note |
| `POST /external/d365/ai/send-flight-data` | `/patient/ai/send-flight-data` | Sync itinerary |
| `GET /external/d365/itinerary/:id` | Internal | Retrieve D365 itinerary |

---

## 📬 Webhooks

| Endpoint | Purpose | Requirements |
|-----------|----------|--------------|
| `POST /webhooks/whatsapp` | WhatsApp inbound message handler | Signature + Idempotency |
| `POST /webhooks/payments` | Payment provider callback | Idempotent + replay-safe |
| `POST /webhooks/efatura` | E-invoice gateway callback | Validates secret token |
| `POST /webhooks/amadeus` | Travel booking callback | Internal API hook |

---

## 📊 Event-Driven Architecture (EDA)

| Event | Producer | Consumer | Description |
|--------|-----------|-----------|-------------|
| `case.created` | Backend | Orchestrator | FSM trigger |
| `approval.required` | Orchestrator | Backend / Ops | Pause FSM |
| `payment.succeeded` | Payment Service | Backend | Update case status |
| `doc.uploaded` | Frontend | Backend | Store document |
| `quote.accepted` | Backend | Orchestrator | Move to itinerary |
| `gpu.job.completed` | AI Service | Monitoring | Track completion |

All queues use **Kafka (primary)** or **RabbitMQ (fallback)** with DLQ and exponential backoff.

---

## 📈 Pagination & Filtering

- Common params:  
  `?page=1&limit=20&status=active&sort=created_at:desc`
- Filters vary by resource (e.g. `/cases?stage=eligibility`)

---

## ⚖️ Rate Limiting

| Tier | Requests/min | Notes |
|------|----------------|-------|
| Free | 60 | Basic demo tier |
| Standard | 300 | Recommended for partners |
| Premium | 1000 | Dedicated tenants |
| Enterprise | Unlimited | SLA-backed clients |

Rate headers:

X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1696861200

---

## 🧩 Versioning Strategy

- **Stable:** `/api/v1/*`
- **Next:** `/api/v2/*`
- **Deprecation:** Sunset header 90 days before removal  
  `Sunset: 2025-12-31`

---

## 🧾 Error Model

| Field | Type | Description |
|--------|------|-------------|
| `statusCode` | number | HTTP status |
| `message` | string | Human-readable message |
| `error` | string | Type or code |
| `timestamp` | string | ISO timestamp |
| `traceId` | string | UUID for observability |

**Example**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Insufficient permissions",
  "traceId": "9b8d11a7-3f29-46ee-942f-d65dc69c43ff"
}


🔗 Related
	•	API_REFERENCE.md
	•	ARCHITECTURE.md
	•	SECURITY_COMPLIANCE.md
	•	DATA_MODEL.md
	•	DEPLOYMENT.md

    Last Updated: October 2025
Version: 2.1
Maintainer: backend@healthtourism.ai
