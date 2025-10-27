# 🔒 Security & Compliance - Health Tourism AI Platform

## Overview

Multi-layered security architecture for KVKK/GDPR compliant medical tourism platform with PII/PHI protection.

---

## 🛡️ Security Layers

### 1. Network Security
- **WAF**: CloudFlare/AWS WAF
- **DDoS Protection**: Rate limiting + geo-blocking
- **TLS 1.3**: End-to-end encryption
- **VPC**: Private subnets for databases

### 2. Authentication & Authorization

#### JWT Strategy
- **Access Token**: 15 minutes expiry, RS256
- **Refresh Token**: 7 days, rotating
- **Token Payload**: `{sub, tenant, roles, permissions, exp}`

#### RBAC/ABAC Model
| Role | Permissions |
|------|------------|
| **Admin** | Full system access |
| **Clinician** | Medical records, treatment plans |
| **Agent** | Cases, bookings, quotes |
| **Patient** | Own data only |

#### ABAC Attributes (CASL)
- **Context**: clinic, region, department
- **Time-based**: working hours, emergency override
- **Clearance**: data sensitivity levels

#### MFA/2FA (Optional)
- **Providers**: Keycloak, Okta, Azure AD
- **Methods**: TOTP, SMS, Email
- **Backup Codes**: 10 single-use codes

---

## 🔐 Data Protection

### Encryption at Rest
- **Database**: AES-256-CBC (PostgreSQL TDE) + application layer AES-256-GCM for sensitive columns
- **Object Storage**: SSE-S3 (MinIO/S3)
- **Redis**: AES-256-GCM (case checkpoints encrypted before write)

### Encryption in Transit
- **API**: TLS 1.3 minimum
- **Internal**: mTLS between services
- **Webhooks**: HMAC-SHA256 signatures

### PII/PHI Handling
```
Fields: name, email, phone, passport, medical_records
Method: AES-GCM app-level encryption
Search: Hash indexes (email_hash, phone_hash)
Masking: ***-**-1234 format
```

---

## 🚦 Access Control

### API Security
- **Rate Limiting**: 100 req/min per IP, 1000 req/min per tenant (`rate:{tenant}:{route}` counters)
- **CORS**: Strict origin validation
- **CSP**: Content Security Policy headers
- **API Keys**: Scoped, rotatable, prefixed (`hta_xxx`)

### Idempotency
- **Header**: `x-idempotency-key`
- **Storage**: Redis SETNX with 1h TTL (`idem:{sha256(tenant:key)}`)
- **Response**: 409 on duplicate

### Webhook Security
- **Signature**: HMAC-SHA256 verification
- **Replay Protection**: Timestamp validation ±5 minutes
- **Retry**: Exponential backoff with DLQ

---

## 📊 Compliance

### KVKK (Turkish GDPR)
- **Article 6**: Explicit consent required
- **Article 9**: Health data special category
- **Article 11**: Data subject rights (access, deletion, portability)
- **Retention**: Configurable per data type

### GDPR Requirements
- **Lawful Basis**: Consent + legitimate interest
- **Data Minimization**: Collect only necessary
- **Right to Erasure**: Soft delete + anonymization
- **Data Portability**: JSON/CSV export

### Consent Management
```
Table: consent_logs
Fields: user_id, type, granted_at, revoked_at, ip, version
Audit: Immutable log with timestamps
```

### Data Retention Policy
| Data Type | Retention | After Expiry |
|-----------|-----------|--------------|
| Medical Records | 10 years | Anonymize |
| Transactions | 7 years | Archive |
| Logs | 1 year | Delete |
| Sessions | 30 days | Delete |

---

## 🔍 Security Monitoring

### Audit Logging
- **What**: All API calls, data access, admin actions
- **Where**: PostgreSQL `audit_logs` table
- **Fields**: `{user, action, resource, ip, timestamp, result}`

### Threat Detection
- **Patterns**: SQL injection, XSS, path traversal
- **Brute Force**: 5 failed attempts = temporary block
- **Anomaly**: Unusual access patterns flagged

### Security Events
```
Topics: security.login_failed, security.mfa_failed, security.suspicious_activity
Action: Alert to security team via Slack/PagerDuty
```

---

## 🔑 Secret Management

### Storage
- **Development**: `.env.local` (gitignored)
- **Staging**: Kubernetes Secrets
- **Production**: HashiCorp Vault / AWS SSM

### Rotation Policy
- **API Keys**: 90 days
- **Database Passwords**: 60 days
- **JWT Secrets**: 30 days
- **Webhook Secrets**: Never (use versioning)

### Environment Variables
```
JWT_SECRET=
D365_CLIENT_SECRET=
DB_PASSWORD=
REDIS_PASSWORD=
S3_SECRET_KEY=
WEBHOOK_SECRET=
```

### Manual Validation Commands
```bash
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/metrics | head -n 5
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets'
curl -s http://localhost:9121/metrics | head -n 5   # Redis exporter
curl -s http://localhost:9187/metrics | head -n 5   # Postgres exporter
```

---

## 🚨 Incident Response

### Response Plan
1. **Detect**: Alert triggered
2. **Assess**: Severity determination
3. **Contain**: Isolate affected systems
4. **Eradicate**: Remove threat
5. **Recover**: Restore normal operations
6. **Review**: Post-mortem analysis

### Contact Points
- **Security Team**: security@health-tourism.io
- **DPO**: dpo@health-tourism.io
- **On-Call**: PagerDuty rotation

---

## ✅ Security Checklist

### Development
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (sanitization)
- [ ] Sensitive data never in logs
- [ ] Dependencies scanned (npm audit)

### Deployment
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Secrets in Vault/SSM
- [ ] Backup encryption verified

### Operations
- [ ] Regular security audits
- [ ] Penetration testing annually
- [ ] Vulnerability scanning weekly
- [ ] Access reviews quarterly
- [ ] Incident drills monthly

---

## 📈 Security Metrics

| Metric | Target | Measure |
|--------|--------|---------|
| Failed login attempts | < 5% | Daily |
| Security incidents | 0 critical | Monthly |
| Patch compliance | 100% within 30d | Weekly |
| Encryption coverage | 100% PII/PHI | Continuous |
| Audit log retention | 100% | Daily |

---

## 🔐 Vulnerability Management

### Scanning Tools
- **Dependencies**: Snyk, npm audit
- **Containers**: Trivy, Clair
- **Code**: SonarQube, CodeQL
- **Infrastructure**: AWS Inspector

### Patching Priority
- **Critical**: 24 hours
- **High**: 7 days
- **Medium**: 30 days
- **Low**: 90 days

---

## 📚 References

- [OWASP Top 10](https://owasp.org/Top10/)
- [KVKK Guidelines](https://kvkk.gov.tr)
- [GDPR Compliance](https://gdpr.eu)
- [ISO 27001 Controls](https://www.iso.org/isoiec-27001-information-security.html)

---

**Security Contact**: security@health-tourism.io  
**Last Updated**: October 2025  
**Version**: 2.0
