# 🧭 Tourism AI Orchestrator & Integration System

> **Version 1.0** — October 2025

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10+-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-yellow.svg)]()

---

## 📋 Table of Contents

- [Vision & Design Principles](#-vision--design-principles)
- [System Overview](#-system-overview)
- [Architecture Layers](#-architecture-layers)
- [Integration Model](#-integration-model)
- [Data Flow & Processing](#-data-flow--processing)
- [AI Core Components](#-ai-core-components)
- [Technology Stack](#-technology-stack)
- [Security & Compliance](#-security--compliance)
- [Monitoring & Scaling](#-monitoring--scaling)
- [Deployment Strategy](#-deployment-strategy)
- [Evolution from Old System](#-evolution-from-old-system)
- [Future Extensions](#-future-extensions)

---

## 🎯 Vision & Design Principles

### Genel Amaç

Turizm ve sağlık turizmi alanındaki kullanıcıların uçtan uca seyahat ve tedavi süreçlerini, yapay zekâ destekli bir karar motoru üzerinden yönetmek.

### Sistem Üç Ana Hedefi Gerçekleştirir:

- **Akıllı Orkestrasyon**: LangGraph FSM yapısı ile sorgu türüne göre doğru ajanı (Agent) yönlendirmek
- **Bağlamsal Karar Verme**: RAG + Ontoloji (Knowledge Graph) ile semantik olarak doğru cevaplar üretmek
- **Bağımsız AI Katmanı**: AI servisini Doktor365 veya başka sistemlerden tamamen bağımsız hâle getirmek

---

## 📊 System Overview

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js / React Native)          │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  Tourism Backend (NestJS)                   │
└──────────────────┬──────────────────────────┘
                   │
                   ↓ (HTTP/gRPC)
┌─────────────────────────────────────────────┐
│  AI-Core Service (Python)                   │
└──────────────────┬──────────────────────────┘
                   │
                   ↓ (REST / internal API)
┌─────────────────────────────────────────────┐
│  External Systems                            │
│  (Doktor365, Maps, Payment, etc.)           │
└─────────────────────────────────────────────┘
```

**AI-Core Service** hem Turizm Backend hem de Doktor365 API'leriyle konuşur. Bu yapı, gelecekte diğer domain'lerde (sağlık, finans, sigorta vb.) yeniden kullanılabilir hale getirilmiştir.

---

## 🏗️ Architecture Layers

| Katman | Bileşen | Açıklama |
|--------|---------|----------|
| **UI Layer** | Next.js (Admin & Web) / React Native (Mobile) | Kullanıcı arayüzü. Realtime WebSocket bağlantısı sağlar. |
| **Application Layer** | NestJS Backend | İş mantığı, kimlik doğrulama, AI API bridge. |
| **Integration Layer** | API Gateway (Kong veya NestJS gateway) | Rate limiting, JWT auth, routing. |
| **AI Layer** | Python LangGraph + LangChain | FSM tabanlı AI Orchestration. |
| **Knowledge Layer** | Neo4j Ontology + Qdrant VectorDB | Semantik reasoning ve context retrieval. |
| **Data Layer** | PostgreSQL, Redis, S3/MinIO | Transaction, cache, media depolama. |
| **Monitoring Layer** | Prometheus, Grafana, LangSmith, Jaeger | İzleme, hata analizi ve tracing. |

---

## 🔄 Integration Model

### Tourism App ↔ AI Core ↔ Doktor365

| Akış | Açıklama |
|------|----------|
| **1. Kullanıcı Sorgusu** | Frontend'den backend'e (NestJS API) gelir. |
| **2. Backend → AI Service** | `/ai/query` endpoint'i üzerinden gönderilir. |
| **3. AI FSM (LangGraph)** | Sorgu tipini belirler (Flight, Hotel, Treatment, vb.). |
| **4. Agents** | Uygun ajanlar devreye girer (örn. ConciergeAgent, MedicalAgent). |
| **5. Data Retrieval** | RAG + Ontology + Doktor365 API'leri çağrılır. |
| **6. Response Generation** | LLM (GPT‑4 / Claude) cevabı oluşturur. |
| **7. Backend → UI** | Cevap, kaynak referansları ile birlikte kullanıcıya gönderilir. |

---

## 🌊 Data Flow & Processing

```
User Query
    ↓
LangGraph Router (FSM)
    ↓
Intent Detection (LLM)
    ↓
Agent Dispatch (CrewAI/AutoGen)
    ↓
RAG Retriever (FAISS / Qdrant)
    ↓
Ontology Reasoner (Neo4j + OWL)
    ↓
LLM Response Generation
    ↓
Hallucination Check (Guardrails)
    ↓
Final Answer + Sources
```

---

## 🤖 AI Core Components

| Bileşen | Görev | Teknoloji |
|---------|-------|-----------|
| **LangGraph Orchestrator** | State machine akışını yönetir | Python LangGraph |
| **LangChain Chains** | Prompt zincirleri, context yönetimi | LangChain |
| **Agents** | Görev tabanlı uzman modüller (Planning, RAG, Compliance, Empathy) | CrewAI / AutoGen |
| **RAG Pipeline** | Veri retrieval, embedding ve re‑ranking | FAISS / Chroma / Qdrant |
| **Knowledge Graph** | Klinik–otel–uçuş ilişkileri, semantik çıkarım | Neo4j + RDF/OWL |
| **MCP (Model Context Protocol)** | Session context yönetimi (hafıza) | Anthropic MCP API / custom |
| **Guardrails** | Hallucination kontrolü ve filtreleme | Guardrails.ai + custom scripts |

---

## 🛠️ Technology Stack

| Katman | Teknolojiler |
|--------|--------------|
| **Frontend** | Next.js 14+, React Native, Tailwind, Shadcn/UI |
| **Backend** | NestJS, TypeScript, PostgreSQL, Redis |
| **AI Core** | Python 3.11, LangGraph, LangChain, CrewAI, Neo4j, FAISS |
| **Infrastructure** | Docker, Kubernetes (EKS/GKE/AKS/DO), Terraform, ArgoCD |
| **Observability** | Prometheus, Grafana, Jaeger, LangSmith |
| **Security** | OAuth2, JWT, OPA, KMS, KVKK/GDPR Compliance |
| **CI/CD** | GitHub Actions, ArgoCD, Snyk |

---

## 🔒 Security & Compliance

### Authentication & Authorization
- OAuth2 + JWT kimlik doğrulama
- RBAC + ABAC erişim kontrolü

### Data Protection
- KMS şifreleme (alan bazlı)
- Guardrails + PII masking (LLM output filtering)

### Compliance
- KVKK / GDPR uyumlu loglama
- Audit Trails: her API çağrısı kaydedilir

---

## 📈 Monitoring & Scaling

### Monitoring Tools
- **OpenTelemetry** → Full trace
- **Prometheus / Grafana** → CPU, latency, memory
- **Jaeger** → Mikroservis trace'leri
- **LangSmith** → LLM call tracing + error analysis

### SLO Hedefleri

| Metrik | Hedef |
|--------|-------|
| API latency (p95) | < 250 ms |
| LLM latency (p95) | < 3 s |
| Hallucination oranı | < 3 % |
| Source coverage | > 95 % |

---

## 🚀 Deployment Strategy

### Local (Development)

Docker Compose kullanarak tüm servisleri tek komutla ayağa kaldırın:

```bash
docker-compose up --build
```

**Özellikler:**
- Her servis `.env.example` dosyasından ayarlar alır
- Geliştirirken `.env` oluşturulur
- Loglar konsola düşer
- Servisler varsayılan portlarda çalışır:
  - Backend: `http://localhost:4000`
  - Frontend: `http://localhost:3000`

### Cloud (Production)

**Kubernetes Deployment:**
- EKS, GKE, AKS veya DigitalOcean üzerinde
- Her mikroservis için Deployment ve Service tanımlayın

**GitOps with ArgoCD:**
- GitHub reposundaki manifestler değiştikçe cluster otomatik güncellenir
- Secrets platformun secret manager'ında saklanır (AWS Secrets Manager, Google Secret Manager vb.)

**GPU Support:**
- Uzun süreli AI işler için GPU node'ları (`nvidia.com/gpu` destekli) kullanın
- Runpod H100/H200 gibi kiralık GPU'ları bağlayın

**Auto-scaling:**
- Trafik artışına göre autoscaler kullanarak kopya sayısını arttırın ya da azaltın

---

## 🔄 Evolution from Old System

| Eski Sistem | Yeni Sistem |
|-------------|-------------|
| Kural tabanlı FSM | LLM + LangGraph FSM |
| Doktor365'e gömülü | Bağımsız AI Service |
| MongoDB session | Redis + MCP Memory |
| Manual operation | Human‑in‑the‑loop Agent |
| Sadece Doktor365 API | Multi‑source (API + RAG + Ontoloji) |
| Hallucination kontrolü yok | Guardrails + Confidence gating |

---

## 🌐 Future Extensions

### Domain Expansion
- **Domain Agnostic AI**: Sağlık, sigorta, finans gibi farklı alanlarda aynı AI çekirdeğini kullanma

### Advanced AI Features
- **Multi‑Agent Workflow**: CrewAI / AutoGen ile rol bazlı ajans sistemleri geliştirme
- **Realtime Voice Assistant**: Whisper STT + ElevenLabs TTS entegrasyonu ile sesli bot

### Knowledge Enhancement
- **Knowledge Graph Reasoning**: GraphRAG ve Neo4j ile gelişmiş semantik sorgular
- **Predictive Analytics**: Kullanıcı davranışından tahminler ve proaktif öner