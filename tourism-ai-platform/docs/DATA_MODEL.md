# 📊 Data Model - Health Tourism AI Platform

## Overview

Multi-tenant data architecture with PostgreSQL (relational), Redis (cache/queue), Qdrant (vectors), and MinIO (documents).

---

## 🗄️ PostgreSQL Schema

### Core Tables

#### users
```sql
id          UUID PRIMARY KEY
email       VARCHAR(255) UNIQUE (encrypted)
email_hash  VARCHAR(64) INDEX (for search)
phone       VARCHAR(50) (encrypted)
role        ENUM('admin','clinician','agent','patient')
tenant_id   UUID REFERENCES tenants(id)
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

#### tenants
```sql
id          UUID PRIMARY KEY
name        VARCHAR(255)
domain      VARCHAR(255) UNIQUE
settings    JSONB
active      BOOLEAN DEFAULT true
created_at  TIMESTAMP
```

#### cases
```sql
id              UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(id)
patient_id      UUID REFERENCES users(id)
status          ENUM('intake','eligibility','travel','docs','approval','itinerary','complete')
priority        ENUM('low','medium','high','urgent')
symptoms        TEXT (encrypted)
medical_history JSONB (encrypted)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### providers
```sql
id          UUID PRIMARY KEY
tenant_id   UUID REFERENCES tenants(id)
name        VARCHAR(255)
specialty   VARCHAR(100)
country     VARCHAR(2)
city        VARCHAR(100)
rating      DECIMAL(3,2)
metadata    JSONB
```

#### quotes
```sql
id          UUID PRIMARY KEY
case_id     UUID REFERENCES cases(id)
provider_id UUID REFERENCES providers(id)
amount      DECIMAL(10,2)
currency    VARCHAR(3)
valid_until DATE
status      ENUM('draft','sent','accepted','rejected','expired')
```

#### bookings
```sql
id              UUID PRIMARY KEY
case_id         UUID REFERENCES cases(id)
quote_id        UUID REFERENCES quotes(id)
flight_details  JSONB
hotel_details   JSONB
treatment_date  DATE
status          ENUM('pending','confirmed','cancelled')
```

### Audit Tables

#### audit_logs
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
action      VARCHAR(100)
resource    VARCHAR(100)
resource_id UUID
ip_address  INET
user_agent  TEXT
timestamp   TIMESTAMP
result      ENUM('success','failure')
metadata    JSONB
```

#### consent_logs
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
type        VARCHAR(50)
version     VARCHAR(10)
granted_at  TIMESTAMP
revoked_at  TIMESTAMP
ip_address  INET
```

### Row-Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their tenant's data
CREATE POLICY tenant_isolation ON cases
  FOR ALL
  TO authenticated_users
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

---

## 🔴 Redis Keys

### Token & Auth
```
d365:token:{tenant}                 # Doktor365 access token (TTL: 55m)
session:{sessionId}                 # User session data (TTL: 24h)
refresh:{userId}:{tokenId}          # Refresh token (TTL: 7d)
mfa:setup:{userId}                  # MFA setup temp data (TTL: 5m)
```

### Idempotency & Rate Limiting
```
idem:{hash(x-idempotency-key)}      # Idempotent request lock (TTL: 1h)
rate:{tenant}:{ip}:{route}          # Rate limit counter (TTL: 1m)
rate:global:{ip}                    # Global rate limit (TTL: 1m)
```

### Case & Orchestration
```
lg:ckpt:{caseId}                    # LangGraph checkpoint (TTL: 7d)
case:state:{caseId}                 # Case state cache (TTL: 1h)
case:lock:{caseId}                  # Processing lock (TTL: 5m)
```

### Queues & Jobs
```
queue:approvals                     # Approval tasks list
queue:webhooks                      # Webhook retry queue
queue:notifications                 # Email/SMS queue
job:status:{jobId}                  # Background job status (TTL: 24h)
```

### Cache
```
cache:provider:list:{specialty}     # Provider list cache (TTL: 15m)
cache:quote:{quoteId}               # Quote details cache (TTL: 1h)
cache:user:{userId}                 # User profile cache (TTL: 30m)
```

---

## 🔍 Qdrant Collections

### medical_knowledge
```json
{
  "name": "medical_knowledge",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "specialty": "keyword",
    "procedure": "keyword", 
    "country": "keyword",
    "language": "keyword",
    "source": "text"
  }
}
```

### provider_profiles
```json
{
  "name": "provider_profiles",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "provider_id": "keyword",
    "specialties": "keyword[]",
    "procedures": "keyword[]",
    "certifications": "keyword[]",
    "rating": "float"
  }
}
```

### case_history
```json
{
  "name": "case_history",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "case_id": "keyword",
    "tenant_id": "keyword",
    "outcome": "keyword",
    "satisfaction": "integer"
  }
}
```

---

## 📁 MinIO Buckets

### Structure
```
health-tourism/
├── documents/
│   ├── {tenant_id}/
│   │   ├── medical-records/
│   │   ├── passports/
│   │   ├── visas/
│   │   └── invoices/
├── uploads/
│   └── temp/
└── exports/
    └── {tenant_id}/
```

### Naming Convention
```
Format: {tenant_id}/{category}/{user_id}/{timestamp}_{filename}
Example: abc-123/medical-records/usr-456/2025-01-15_blood-test.pdf
```

### Security
- **Presigned URLs**: 15-minute expiry for uploads
- **Encryption**: Server-side AES-256
- **Access**: IAM policies per tenant

---

## 🔄 Event Topics (Kafka/RabbitMQ)

### Case Events
```
case.created        # New case initiated
case.updated        # Case status changed
case.assigned       # Provider assigned
case.completed      # Journey finished
```

### Approval Events
```
approval.required   # Human intervention needed
approval.granted    # Approved by operator
approval.denied     # Rejected with reason
```

### Payment Events
```
payment.initiated   # Payment started
payment.succeeded   # Payment confirmed
payment.failed      # Payment rejected
payment.refunded    # Refund processed
```

### Document Events
```
doc.uploaded        # Document received
doc.verified        # Document validated
doc.rejected        # Document invalid
```

---

## 📈 Data Retention

| Data Type | Active Storage | Archive | Deletion |
|-----------|---------------|---------|----------|
| Cases | 1 year | 5 years | 6 years |
| Medical Records | 2 years | 10 years | Never* |
| Payments | 1 year | 7 years | 8 years |
| Audit Logs | 3 months | 1 year | 2 years |
| Sessions | 30 days | - | 30 days |
| Temp Files | 24 hours | - | 24 hours |

*Anonymized after retention period

---

## 🔐 Data Privacy

### PII Fields (Encrypted)
- Full name
- Email address
- Phone number
- Passport number
- Medical conditions
- Payment details

### Anonymization Strategy
```sql
UPDATE users SET
  email = CONCAT('anon_', MD5(email), '@deleted.com'),
  phone = 'DELETED',
  name = 'ANONYMOUS'
WHERE deleted_at < NOW() - INTERVAL '6 years';
```

### GDPR Data Export
```json
{
  "user": {
    "id": "uuid",
    "email": "***@example.com",
    "created_at": "2025-01-01"
  },
  "cases": [...],
  "documents": [...],
  "consent_history": [...]
}
```

---

## 🚀 Performance Optimization

### Indexes
```sql
CREATE INDEX idx_cases_tenant_status ON cases(tenant_id, status);
CREATE INDEX idx_cases_created ON cases(created_at DESC);
CREATE INDEX idx_providers_specialty ON providers(tenant_id, specialty);
CREATE INDEX idx_audit_user_timestamp ON audit_logs(user_id, timestamp DESC);
```

### Partitioning
```sql
-- Partition audit_logs by month
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Query Optimization
- Use prepared statements
- Limit result sets (pagination)
- Avoid N+1 queries
- Cache frequently accessed data

---

## 📊 Monitoring Queries

### Active Cases by Status
```sql
SELECT status, COUNT(*) 
FROM cases 
WHERE tenant_id = ? 
GROUP BY status;
```

### Provider Performance
```sql
SELECT p.name, COUNT(b.id) as bookings, AVG(q.amount) as avg_quote
FROM providers p
JOIN quotes q ON p.id = q.provider_id
JOIN bookings b ON q.id = b.quote_id
WHERE b.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.id;
```

### Consent Compliance
```sql
SELECT COUNT(DISTINCT user_id) as users_with_consent
FROM consent_logs
WHERE type = 'data_processing'
AND revoked_at IS NULL;
```

---

**Last Updated**: October 2025  
**Version**: 2.0