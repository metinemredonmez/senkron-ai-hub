# 🔍 API Coverage Report — Tourism AI Platform
**Generated:** 2025-10-24T07:23:30.690Z
**Total Endpoints Discovered:** 24
**Base URL:** http://localhost:4000/api
**Test Run:** ✅ Completed

---

## 📊 Overall Statistics

- **Total Endpoints:** 24
- **Tested:** 0
- **✅ Passed (2xx):** 0
- **⚠️  Unauthorized (401):** 0
- **❌ Not Found (404):** 0
- **🔥 Errors (5xx/other):** 0
- **📈 Overall Coverage:** 0%

---

## 📦 Coverage by Module

| Module | Endpoints | OK | 401 | 404 | Errors | Coverage |
|--------|-----------|----|----|-----|---------|----------|
| hub.controller.ts | 2 | 0 | 0 | 0 | 2 | ❌ 0% |
| auth | 3 | 0 | 0 | 0 | 3 | ❌ 0% |
| bookings | 1 | 0 | 0 | 0 | 1 | ❌ 0% |
| cases | 2 | 0 | 0 | 0 | 2 | ❌ 0% |
| catalog | 1 | 0 | 0 | 0 | 1 | ❌ 0% |
| docs-visa | 3 | 0 | 0 | 0 | 3 | ❌ 0% |
| external | 2 | 0 | 0 | 0 | 2 | ❌ 0% |
| patients | 2 | 0 | 0 | 0 | 2 | ❌ 0% |
| pricing | 2 | 0 | 0 | 0 | 2 | ❌ 0% |
| providers | 1 | 0 | 0 | 0 | 1 | ❌ 0% |
| tenants | 2 | 0 | 0 | 0 | 2 | ❌ 0% |
| travel | 3 | 0 | 0 | 0 | 3 | ❌ 0% |

---

## 📋 Detailed Results by Module

### hub.controller.ts (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/hub/agents` | 🔥 N/A | 10 | None | List registered agents |
| POST | `/hub/events/publish` | 🔥 N/A | 2 | None | Alias for publish event endpoint used by orchestrator bridge |

### auth (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| POST | `/auth/login` | 🔥 N/A | 1 | JwtAuthGuard | Authenticate with email/password |
| POST | `/auth/refresh` | 🔥 N/A | 2 | JwtAuthGuard | Refresh access token using a valid refresh token |
| GET | `/auth/me` | 🔥 N/A | 1 | JwtAuthGuard, JwtAuthGuard | Return authenticated user profile along with tenant context |

### bookings (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| PATCH | `/bookings/:id` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Update booking status |

### cases (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/cases/:id` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Retrieve a case by identifier |
| POST | `/cases/:caseId/approvals/:taskId` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Resolve an approval task for a case |

### catalog (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| PUT | `/catalog/packages/:id` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Update catalog package |

### docs-visa (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| POST | `/docs-visa/presign` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard, PoliciesGuard | Generate presigned upload URL for visa documents |
| GET | `/docs-visa/cases/:caseId` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard, PoliciesGuard | List visa documents for a case |
| PATCH | `/docs-visa/:id/verify` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard, PoliciesGuard | Mark a visa document as verified |

### external (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/only-channel/token` | 🔥 N/A | 1 | None | Retrieve the OnlyChannel token for the current tenant |
| POST | `/webhooks/whatsapp` | 🔥 N/A | 1 | None | Handle WhatsApp inbound message webhook |

### patients (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/patients/:id` | 🔥 N/A | 0 | JwtAuthGuard, RolesGuard | Retrieve a patient by identifier |
| PUT | `/patients/:id` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Update an existing patient record |

### pricing (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/pricing/cases/:caseId` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | List pricing quotes for a case |
| POST | `/pricing/quotes` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Create a pricing quote for a case via AI orchestrator |

### providers (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| PUT | `/providers/:id` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Update provider details |

### tenants (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/tenants/current` | 🔥 N/A | 1 | JwtAuthGuard, JwtAuthGuard | Retrieve the tenant resolved from the current request context |
| POST | `/tenants/register` | 🔥 N/A | 1 | JwtAuthGuard, JwtAuthGuard, RolesGuard | Register or update metadata for a tenant |

### travel (0% coverage)

| Method | Path | Status | Time (ms) | Guards | Summary |
|--------|------|--------|-----------|--------|----------|
| GET | `/travel/cases/:caseId` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Retrieve travel plan for a case |
| POST | `/travel/cases/:caseId/sync` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Sync travel plan data from orchestrator |
| GET | `/travel/cases/:caseId/itinerary.ics` | 🔥 N/A | 1 | JwtAuthGuard, RolesGuard | Download travel itinerary iCalendar file |

---

---

## 🔧 Fix Recommendations

---

## ✅ Validation Checklist

- [ ] All endpoints return expected status codes
- [ ] All endpoints documented in Swagger
- [ ] Auth guards properly configured
- [ ] Tenant context enforced where needed
- [ ] Response times under 500ms
- [ ] Content-Type headers correct

---

**Audit Complete** ✅
