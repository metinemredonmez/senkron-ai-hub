🏥 Health Tourism AI Platform (Version 3 — October 2025)

Enterprise-grade, AI-powered, KVKK/GDPR-compliant medical tourism orchestration system.
Built for secure, multi-tenant healthcare travel journeys — from intake to aftercare — with human-in-the-loop AI orchestration.

🧭 Overview

A modular monorepo integrating:

Backend: NestJS 10 (TypeScript), PostgreSQL, Redis, Kafka, RabbitMQ, Elasticsearch

AI Services: FastAPI + LangGraph FSM Orchestrator, Qdrant, LangChain

Frontend: Next.js 14 (App Router), Tailwind CSS

Mobile: Expo React Native 0.73

Infra: Docker Compose (local), Kubernetes + Terraform (production)

Observability: Prometheus, Grafana, Loki, Tempo

All components adhere to 12-factor principles, JWT RBAC/ABAC, AES-GCM encryption, and idempotent webhooks.

🏗️ Architecture Diagram
graph TD
  A[Frontend - Next.js] -->|REST/GraphQL| B[NestJS Backend]
  M[Mobile - Expo RN] -->|REST| B
  B -->|Orchestration| O[AI Orchestrator - FastAPI]
  B -->|Proxy| D365[Doktor365 API]
  B -->|DB| P[(PostgreSQL)]
  B -->|Cache| R[(Redis)]
  B -->|Queue| K[(Kafka / RabbitMQ)]
  B -->|Search| E[(Elasticsearch)]
  O -->|Vector| Q[(Qdrant)]
  O -->|Storage| S[(MinIO S3)]
  B --> L[(Prometheus / Grafana / Tempo / Loki)]

📂 Project Structure
health-tourism-ai-platform/
├── backend/                # NestJS backend
├── frontend/               # Next.js web frontend
├── mobile/                 # Expo React Native mobile app
├── ai-services/            # FastAPI microservices (LangGraph, RAG, Speech, Vision, Personalization)
│   ├── orchestrator-svc/
│   ├── ai-nlp/
│   ├── ai-speech/
│   ├── ai-vision/
│   └── ai-personalization/
├── shared/                 # Shared TypeScript types and utils
├── infrastructure/         # IaC: Docker, K8s, Terraform
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
├── monitoring/             # Grafana, Prometheus, Loki, Tempo configs
├── tools/                  # CLI utilities (db-seed, clear-cache, check-health)
├── docs/                   # Architecture, Deployment, API, Security
└── scripts/                # DevOps shell scripts

⚙️ Quick Start (Local Development)
1️⃣ Install Dependencies
yarn install

2️⃣ Copy Environment Files
cp .env.example .env.local
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
cp ai-services/orchestrator-svc/.env.example ai-services/orchestrator-svc/.env.local

3️⃣ Start Local Services
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
cd backend
yarn start:dev

4️⃣ Verify
curl http://localhost:4000/api/health
# ✅ Should return { "status": "ok" }


Access:

Backend API: http://localhost:4000/api

Swagger UI: http://localhost:4000/api/docs

Frontend Web: http://localhost:3000

Orchestrator: http://localhost:8080/health

Grafana: http://localhost:3001

🧩 Technology Stack
Layer	Key Tools
Backend	NestJS 10, TypeORM, PostgreSQL 15, Redis 7, Kafka, RabbitMQ
AI Services	FastAPI, LangGraph, LangChain, Qdrant 1.11.2
Frontend	Next.js 14, Tailwind CSS, Zustand, React Query
Mobile	Expo 50, React Native 0.73, Redux Toolkit
Storage	MinIO S3-compatible buckets
Observability	Prometheus, Grafana, Tempo, Loki
Security	JWT, RBAC/ABAC, AES-GCM encryption
Infrastructure	Docker Compose, Kubernetes, Terraform
🔐 Security Model

JWT + RBAC/ABAC: multi-tenant role & attribute-based access control

AES-GCM encryption: sensitive data fields (email, passport, phone)

Idempotent webhooks: all POST/PATCH routes require X-Idempotency-Key

Rate limiting: per IP + tenant (nestjs/throttler)

KVKK/GDPR compliant: consent logging, data anonymization, retention policies

🧠 AI Orchestration (LangGraph FSM)

FSM Nodes: intake → eligibility → clinical_summary → provider_match → pricing → travel → docs_visa → approvals → itinerary → aftercare

Checkpoint: Redis lg:ckpt:{caseId}

Observability: Prometheus metrics, Tempo tracing

Non-diagnostic guardrails: all outputs wrapped with disclaimers

PHI redaction: automatic redaction pipeline

🧱 Environment Management
File	Purpose
.env.local	Local development
.env.prod	Production (K8s + Terraform)
.env.example	Template

Docker Compose auto-loads env files per service.

📈 Monitoring & Observability
Service	URL	Notes
Grafana	http://localhost:3001
	Dashboards for latency, errors, AI calls
Prometheus	http://localhost:9090
	Metrics collection
Loki	http://localhost:3100
	Log aggregation
Tempo	http://localhost:4318
	Tracing pipeline
Example Alerts

High API latency (> 500ms, 5m)

Redis connection drop

Case orchestration timeout

RAG hallucination > 3%

🚀 Deployment Overview
Environment	Tooling	Purpose
Local	Docker Compose	Developer hot-reload
Staging	Kubernetes (EKS) + Terraform	QA, pre-prod
Production	K8s + External Secrets + ArgoCD	Live workloads
# Provision infrastructure
cd infrastructure/terraform
terraform init && terraform apply

# Deploy workloads
cd ../kubernetes
kubectl apply -f namespaces/
kubectl apply -f backend/
kubectl apply -f ai/

🧩 API Endpoints Summary
Module	Example Route	Description
Auth	/auth/login	JWT auth with tenant context
Patients	/patients	Create and manage patient profiles
Cases	/cases	Create, track, and orchestrate cases
Pricing	/pricing/quote	AI-driven quote generation
Docs & Visa	/docs-visa/presign	Presigned upload URLs
AI Bridge	/ai/orchestrate	Triggers orchestrator FSM
Webhooks	/webhooks/payments	Stripe/Iyzico callbacks
Monitoring	/api/health, /metrics	Health and metrics endpoints

Swagger UI: /api/docs

🧭 Validation Checklist

✅ yarn start:dev compiles successfully
✅ /api/health returns OK
✅ Redis & Postgres connected
✅ Swagger UI accessible
✅ Grafana dashboard populated
✅ AI orchestrator transitions visible

🧩 Future Roadmap Highlights
Phase	Goal
Q1 2026	AI-Vision Guardrails + Orthanc/DICOM Integration
Q2 2026	Kafka async job queue for heavy workloads
Q3 2026	Multilingual AI assistant (Speech + Personalization)
Q4 2026	Global partner APIs (FHIR/DICOM/USHAŞ sync)

Maintained by: AI & Cloud Architecture Team — Health Tourism AI Platform
Last Updated: October 2025
Status: ✅ Production Ready