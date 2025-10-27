⚙️ Sonraki adım:
Ben şimdi önce API_REFERENCE.md (detaylı versiyon) dosyasını Markdown içinde tam biçimiyle yazacağım.
Bu bittikten sonra API_SURFACE.md (özet versiyon) dokümanını yazacağım.

👥 Patients Module

Method
Endpoint
Description
POST
/patients
Create patient (AES-GCM encrypted PII)
GET
/patients
List (paginated, masked PII)
GET
/patients/:id
Get full profile + case links
PATCH
/patients/:id
Update patient data
DELETE
/patients/:id
Soft delete / anonymize
POST
/patients/:id/consent
Record consent log
GET
/patients/:id/history
Medical / case timeline

Encryption Rules
Fields email, phone, passport_number → AES-GCM; stored masked, decrypted only for clinician/ops roles.

⸻


💼 Cases Module (FSM Integrated)

Method
Endpoint
Description
POST
/cases
Create case & start orchestrator
GET
/cases/:id
Fetch full case
GET
/cases
List cases
PATCH
/cases/:id
Update case stage
POST
/cases/:id/approve
Approve pending stage
POST
/cases/:id/reject
Reject stage
GET
/cases/:id/timeline
Retrieve event log
POST
/cases/:id/notes
Add staff notes


FSM Hooks
	•	POST /ai/start-case → Orchestrator /orchestrate/start
	•	GET /ai/state/:caseId → /orchestrate/state/{caseId}
	•	POST /ai/resume-case → Resume after human approval
	•	Redis stores checkpoints: lg:ckpt:{caseId}


💰 Pricing Module

Method
Endpoint
Description
POST
/pricing/quote
Generate new quote
GET
/pricing/:id
Retrieve quote
PATCH
/pricing/:id/accept
Accept
PATCH
/pricing/:id/reject
Reject
POST
/pricing/:id/negotiate
Request discount negotiation


Output includes medical disclaimer:

“This quote is non-diagnostic and educational only.”


✈️ Travel Module
Method
Endpoint
Description
GET
/travel/flights
Query flights (Amadeus sandbox)
GET
/travel/hotels
Search hotels
POST
/travel/book
Create booking
GET
/travel/itinerary/:caseId
Get PDF/ICS itinerary
POST
/travel/cancel
Cancel booking
Uses Redis cache for API rate control: rate:{tenant}:{route}.


📑 Docs & Visa Module

Method
Endpoint
Description
GET
/docs/presign
Generate presigned upload URL
POST
/docs/upload
Register uploaded doc
GET
/docs/status/:caseId
Check missing docs
DELETE
/docs/:id
Delete
GET
/docs/:id/download
Secure download (MinIO presign)

Presigned URLs expire 15 min; verified in backend before issuing.

🤖 AI Bridge & Orchestrator Integration


Method
Endpoint
Description
POST
/ai/orchestrate
Start LangGraph FSM
POST
/ai/resume-case
Resume after human approval
GET
/ai/state/:caseId
Fetch orchestration state
GET
/ai/get-checkpoint/:caseId
Retrieve Redis checkpoint
POST
/ai/rag/query
Semantic Qdrant search
POST
/ai/speech/tts
Text-to-speech
POST
/ai/vision/pre-eval
Vision pre-evaluation summary
POST
/ai/personalization/recommend
Journey hints

All AI responses include non-diagnostic disclaimers and source citations.

🌐 External Integrations (Doktor365 Proxy)
Method
Endpoint
Maps To
Purpose
GET
/external/d365/deals/:id
/patient/deals/{id}
Fetch patient deal
POST
/external/d365/deals/:id/notes
/patient/deals/note
Add note
POST
/external/d365/ai/send-flight-data
/patient/ai/send-flight-data
Share itinerary
GET
/external/d365/itinerary/:id
D365 internal
Pull itinerary PDF

Authentication handled by Redis token cache: d365:token:{tenant}.
Idempotency enforced: idem:{x-idempotency-key}.

⸻

📬 Webhooks
Endpoint
Source
Description
/webhooks/whatsapp
Meta Cloud API
Patient messages
/webhooks/payments
Stripe/Iyzico
Payment confirmation
/webhooks/efatura
e-Invoice Gateway
Invoice status
/webhooks/amadeus
Amadeus
Booking callbacks
Webhook Rules
	•	Signature verified
	•	X-Idempotency-Key required
	•	Response { "ok": true }
	•	Replay protected by Redis SETNX
📊 Monitoring & Observability


Endpoint
Description
/metrics
Prometheus metrics
/health
Composite health
/health/live
Liveness probe
/health/ready
Readiness probe
/logs
Stream logs (Loki format)
Example:

{
  "status": "ok",
  "database": { "status": "up", "latency_ms": 8 },
  "redis": { "status": "up", "latency_ms": 2 },
  "uptime_seconds": 86400,
  "version": "2.1.0"
}

⚙️ Event-Driven Topics

Event
Producer
Consumer
Purpose
case.created
Backend
Orchestrator
Start FSM
approval.required
Orchestrator
Ops Console
Await human input
payment.succeeded
Payment
Backend
Update case
doc.uploaded
Frontend
Backend
Register doc
quote.accepted
Backend
Orchestrator
Move to itinerary
gpu.job.completed
AI service
Monitoring
Track jobs


Queues handled via Kafka or RabbitMQ; DLQ pattern applied.
🔑 Security & Rate Limits

Mechanism
Description
JWT
Tenant + roles + exp
ABAC
CASL attributes
Rate Limit
nestjs/throttler per IP + tenant
AES-GCM
PII encryption
RBAC
Roles: admin, clinician, ops, patient
MFA
Optional OIDC

Rate-limit headers returned in every response:


X-RateLimit-Limit: 300
X-RateLimit-Remaining: 280
X-RateLimit-Reset: 1696861200
🧾 Error Model

{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "timestamp": "2025-10-09T10:00:00Z",
  "path": "/cases",
  "requestId": "b7a4a0b1-8b39-4a65-8020-5c3b35de8123"
}

📚 Related Documents
	•	ARCHITECTURE.md
	•	AI_SERVICES.md
	•	SECURITY_COMPLIANCE.md
	•	DATA_MODEL.md
	•	DEPLOYMENT.md


ast Updated: October 2025
Version: 2.1
Maintainer: backend@healthtourism.ai