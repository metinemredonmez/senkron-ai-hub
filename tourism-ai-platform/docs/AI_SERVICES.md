# 🤖 AI Services — Health Tourism AI Platform (Version 3.0 / October 2025)

This document defines the AI microservices that power the orchestration, reasoning, and personalization layer of the Health Tourism AI Platform.

Each service is modular, FastAPI-based, resilient with circuit breakers, and fully observable with `/health`, `/metrics`, and `/docs` endpoints.

---

## 🧠 Orchestrator Service

| Attribute | Details |
|-----------|---------|
| **Language** | Python 3.11 |
| **Framework** | FastAPI + LangGraph |
| **Port** | 8080 |
| **Purpose** | Manages the entire patient journey flow (FSM-based orchestration) |
| **Resilience** | Circuit breakers, retry patterns, idempotency |

### Core Responsibilities

- ✅ **LangGraph state machine** for patient intake → eligibility → quote → travel → aftercare
- ✅ **Human-in-the-loop approvals** via event-driven architecture
- ✅ **Redis checkpoint persistence** with v3 canonical keys (`lg:ckpt:{caseId}`)
- ✅ **D365 integration** for provider matching and deal synchronization
- ✅ **Circuit breakers** on all external service calls
- ✅ **Idempotent operations** with Redis SETNX
- ✅ **Event publishing** to Kafka/RabbitMQ topics

### Example Endpoints

| Endpoint | Method | Description | Idempotent |
|----------|--------|-------------|------------|
| `/health` | GET | Health check | - |
| `/orchestrate/start` | POST | Initiates case orchestration | ✅ |
| `/orchestrate/resume` | POST | Resumes after human approval | ✅ |
| `/orchestrate/state/{caseId}` | GET | Returns current FSM state | - |
| `/orchestrate/cancel/{caseId}` | POST | Cancels active orchestration | ✅ |
| `/orchestrate/history/{caseId}` | GET | Returns orchestration history | - |

### Event Integration (v3)

```python
# Event publishing with idempotency
async def publish_event(topic: str, event: dict):
    idempotency_key = event.get("idempotency_key")
    
    # Check idempotency
    if not await redis.setnx(f"idem:{idempotency_key}", "1", ex=3600):
        return {"status": "duplicate", "key": idempotency_key}
    
    # Publish to Kafka
    await kafka_producer.send(topic, event)
```

**Event Topics:**
- `case.created` - New orchestration started
- `approval.required` - Human approval needed
- `payment.succeeded` - Payment confirmed
- `quote.accepted` - Quote approved

### D365 Tool Integration

```python
# orchestrator/tools/d365.py
from circuit_breaker import circuit

class D365Tool:
    @circuit(failure_threshold=5, recovery_timeout=30)
    async def get_deal(self, deal_id: str) -> dict:
        """Get deal from D365 with circuit breaker protection"""
        token = await redis.get("d365:token:{tenant}")
        if not token:
            token = await self.refresh_token()
        return await self.http.get(f"/patient/deals/{deal_id}")
    
    @circuit(failure_threshold=3, recovery_timeout=60)
    async def send_flight_data(self, deal_id: str, flight_data: dict):
        """Send confirmed flight to D365"""
        return await self.http.post("/patient/ai/send-flight-data", {
            "dealId": deal_id,
            "flightData": flight_data
        })
```

### Redis Checkpoint (v3 Keys)

```python
# v3 canonical key format
CHECKPOINT_KEY = "lg:ckpt:{case_id}"
STATE_KEY = "case:state:{case_id}"
LOCK_KEY = "case:lock:{case_id}"

async def save_checkpoint(case_id: str, state: dict):
    await redis.setex(
        CHECKPOINT_KEY.format(case_id=case_id),
        604800,  # 7 days TTL
        json.dumps(state)
    )
```

---

## 🔍 AI-NLP (RAG) Service

| Attribute | Details |
|-----------|---------|
| **Language** | Python 3.11 |
| **Framework** | FastAPI + LangChain |
| **Port** | 8200 |
| **Purpose** | Semantic retrieval and contextual reasoning |
| **Resilience** | Retry patterns, fallback to cache |

### Core Responsibilities

- ✅ **Vector search** with Qdrant (circuit breaker protected)
- ✅ **Multi-tenant hybrid search** with metadata filtering
- ✅ **Caching layer** with Redis for frequent queries
- ✅ **Idempotent document ingestion**
- ✅ **Guaranteed sources[] array** in all responses

### Example Endpoints

| Endpoint | Method | Description | Cache |
|----------|--------|-------------|-------|
| `/health` | GET | Health check | - |
| `/rag/ingest` | POST | Uploads and embeds a document | - |
| `/rag/query` | POST | Queries with citations | ✅ |
| `/rag/delete/{docId}` | DELETE | Removes document | - |
| `/rag/list` | GET | Lists indexed documents | ✅ |

### Query with Cache

```python
async def query_with_cache(query: str, tenant_id: str):
    # Check cache first
    cache_key = f"cache:rag:{hashlib.md5(f'{query}:{tenant_id}'.encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Query Qdrant with circuit breaker
    try:
        result = await qdrant_query(query, tenant_id)
    except CircuitOpenError:
        # Fallback to broader cache or default response
        result = await get_fallback_response(query)
    
    # Cache result
    await redis.setex(cache_key, 900, json.dumps(result))  # 15 min TTL
    return result
```

---

## 🗣️ AI-Speech Service

| Attribute | Details |
|-----------|---------|
| **Language** | Python 3.11 |
| **Framework** | FastAPI |
| **Port** | 8300 |
| **Purpose** | Speech-to-text (STT) and text-to-speech (TTS) |
| **Resilience** | Job queue with retry, MinIO fallback |

### Core Responsibilities

- ✅ **Async job processing** with Redis queue
- ✅ **Idempotent job submission** 
- ✅ **Circuit breaker** on STT/TTS API calls
- ✅ **MinIO storage** with presigned URLs
- ✅ **Job status tracking** with TTL

### Example Endpoints

| Endpoint | Method | Description | Async |
|----------|--------|-------------|-------|
| `/health` | GET | Health check | - |
| `/stt/transcribe` | POST | Transcribes audio | ✅ |
| `/tts/synthesize` | POST | Generates speech | ✅ |
| `/jobs/{id}` | GET | Returns job status | - |
| `/audio/download/{fileId}` | GET | Downloads audio | - |

### Job Queue Pattern

```python
async def submit_job(job_type: str, payload: dict) -> str:
    job_id = str(uuid.uuid4())
    
    # Idempotency check
    if payload.get("idempotency_key"):
        existing = await redis.get(f"idem:job:{payload['idempotency_key']}")
        if existing:
            return existing
    
    # Queue job
    await redis.lpush("queue:speech_jobs", json.dumps({
        "id": job_id,
        "type": job_type,
        "payload": payload,
        "retry_count": 0,
        "created_at": datetime.utcnow().isoformat()
    }))
    
    # Track status
    await redis.setex(f"job:status:{job_id}", 86400, "queued")
    
    return job_id
```

---

## 👁️ AI-Vision Service

| Attribute | Details |
|-----------|---------|
| **Language** | Python 3.11 |
| **Framework** | FastAPI |
| **Port** | 8400 |
| **Purpose** | Educational, non-diagnostic visual summaries |
| **Compliance** | KVKK/GDPR, audit trails |

### Core Responsibilities

- ✅ **Non-diagnostic image analysis** with disclaimers
- ✅ **DICOM support** with anonymization
- ✅ **Circuit breaker** on vision API calls
- ✅ **Audit logging** for compliance
- ✅ **PII redaction** before processing

### Example Endpoints

| Endpoint | Method | Description | Audit |
|----------|--------|-------------|-------|
| `/health` | GET | Health check | - |
| `/vision/medical-pre-eval` | POST | Educational summary | ✅ |
| `/vision/audit` | GET | Access logs | - |
| `/vision/supported-types` | GET | Supported formats | - |

### Non-Diagnostic Enforcement

```python
async def process_medical_image(image: bytes) -> dict:
    # Anonymize DICOM metadata
    clean_image = await anonymize_dicom(image)
    
    # Process with circuit breaker
    try:
        analysis = await vision_api.analyze(clean_image)
    except CircuitOpenError:
        return {
            "error": "Service temporarily unavailable",
            "retry_after": 30
        }
    
    # Enforce disclaimer
    return {
        "summary": sanitize_medical_terms(analysis),
        "disclaimer": "This is NOT a medical diagnosis. Consult a licensed physician.",
        "confidence": "educational_only",
        "requires_professional_review": True,
        "audit_id": await log_audit_trail(image_hash)
    }
```

---

## 💡 AI-Personalization Service

| Attribute | Details |
|-----------|---------|
| **Language** | Python 3.11 |
| **Framework** | FastAPI |
| **Port** | 8500 |
| **Purpose** | Next-best actions and journey personalization |
| **Optimization** | Redis caching, batch predictions |

### Core Responsibilities

- ✅ **ML-based recommendations** with fallback rules
- ✅ **Context-aware personalization** 
- ✅ **A/B testing support** with feature flags
- ✅ **Cache warming** for frequent segments
- ✅ **Event-driven model updates**

### Example Endpoints

| Endpoint | Method | Description | Cache |
|----------|--------|-------------|-------|
| `/health` | GET | Health check | - |
| `/rec/next-best` | POST | Next best actions | ✅ |
| `/rec/journey-hints` | POST | Journey guidance | ✅ |
| `/rec/optimal-time` | POST | Contact timing | ✅ |
| `/rec/batch` | POST | Batch predictions | - |

### Personalization with Cache

```python
async def get_recommendations(user_id: str, context: dict) -> dict:
    # Check segment cache
    segment = await get_user_segment(user_id)
    cache_key = f"cache:rec:{segment}:{context['stage']}"
    
    cached = await redis.get(cache_key)
    if cached:
        return personalize_cached_response(cached, user_id)
    
    # Generate fresh recommendations
    recs = await ml_model.predict(user_id, context)
    
    # Cache by segment
    await redis.setex(cache_key, 1800, json.dumps(recs))  # 30 min
    
    return recs
```

---

## ⚙️ Environment Variables (v3)

| Variable | Description |
|----------|-------------|
| **Redis & Queues** | |
| `REDIS_URL` | Redis for cache, queues, checkpoints |
| `KAFKA_BROKERS` | Kafka broker list |
| **External Services** | |
| `D365_BASE_URL` | Doktor365 API endpoint |
| `D365_CLIENT_ID` | D365 OAuth client ID |
| `QDRANT_URL` | Vector database endpoint |
| `MINIO_ENDPOINT` | S3-compatible storage |
| **Circuit Breakers** | |
| `CIRCUIT_FAILURE_THRESHOLD` | Failures before opening (default: 5) |
| `CIRCUIT_RECOVERY_TIMEOUT` | Seconds before retry (default: 30) |
| **Observability** | |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Tempo endpoint |
| `LANGSMITH_API_KEY` | LangSmith tracking |
| `PROMETHEUS_PUSHGATEWAY_URL` | Metrics gateway |

---

## 📡 Metrics & Monitoring (v3)

### Key Metrics

```prometheus
# Service health
ai_service_health{service="orchestrator"} 1

# Request metrics
ai_service_requests_total{service="nlp",endpoint="/rag/query",status="success"} 1250
ai_service_request_duration_seconds{service="vision",endpoint="/medical-pre-eval"} 3.2

# Circuit breaker metrics
circuit_breaker_state{service="orchestrator",dependency="d365"} 0  # 0=closed, 1=open
circuit_breaker_failures_total{service="nlp",dependency="qdrant"} 3

# Cache metrics
cache_hit_rate{service="personalization"} 0.87
cache_operations_total{service="nlp",operation="get",status="hit"} 543

# Queue metrics
queue_depth{queue="speech_jobs"} 12
queue_processing_time_seconds{queue="vision_jobs"} 4.5

# D365 integration
d365_api_calls_total{endpoint="/deals",method="GET"} 234
d365_api_latency_seconds{endpoint="/ai/send-flight-data"} 1.8
```

### Grafana Dashboards

1. **AI Services Overview**
   - Service health status
   - Request rates and latencies
   - Error rates by service

2. **Circuit Breaker Status**
   - Open/closed states
   - Failure counts
   - Recovery patterns

3. **Cache Performance**
   - Hit/miss ratios
   - Cache size and evictions
   - TTL distribution

4. **Queue Monitoring**
   - Queue depths
   - Processing times
   - DLQ accumulation

---

## 🔒 Security & Compliance

### Authentication
- Service-to-service via API keys
- JWT validation on public endpoints
- Rate limiting per tenant

### Data Privacy
- PII encryption with AES-GCM
- Audit logs retained 90 days
- KVKK/GDPR compliant processing
- Consent verification before processing

### Input Validation
- File size limits (25MB audio, 50MB images)
- Content-type validation
- Malicious file scanning
- Injection attack prevention

---

## 🧪 Testing

### Unit Tests
```bash
cd ai-services
pytest tests/ -v --cov
```

### Integration Tests
```bash
# Test with circuit breakers
pytest tests/integration/test_resilience.py -v

# Test idempotency
pytest tests/integration/test_idempotency.py -v
```

### Load Tests
```bash
# With circuit breaker triggers
locust -f tests/load/locustfile.py --host=http://localhost:8080
```

---

## 🚀 Deployment

### Docker Compose (Local)
```bash
docker-compose up -d orchestrator-svc ai-nlp ai-speech ai-vision ai-personalization
```

### Kubernetes (Production)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator-svc
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: orchestrator
        env:
        - name: CIRCUIT_FAILURE_THRESHOLD
          value: "5"
        - name: REDIS_URL
          value: "redis://redis:6379"
        livenessProbe:
          httpGet:
            path: /health
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /health
          initialDelaySeconds: 5
```

---

## 📚 Related Documentation

- [Architecture v2](ARCHITECTURE.md)
- [Integration Guide v3](ARCHITECTURE_INTEGRATION_V3.md)
- [Agents & FSM v3](AGENTS_FSM.md)
- [Data Model](DATA_MODEL.md)
- [API Reference](API_REFERENCE.md)

---

**Last Updated:** October 2025  
**Version:** 3.0  
**Status:** Production Ready