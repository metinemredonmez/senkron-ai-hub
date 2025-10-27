#!/usr/bin/env ts-node
/**
 * Health Tourism AI Platform — Service Health Checker
 * Checks /health endpoints for all active microservices
 */

import axios from "axios";

const services = [
  { name: "Backend API", url: "http://localhost:4000/api/health" },
  { name: "Frontend Web", url: "http://localhost:3000" },
  { name: "AI Orchestrator", url: "http://localhost:8080/health" },
  { name: "AI-NLP (RAG)", url: "http://localhost:8200/health" },
  { name: "AI-Speech", url: "http://localhost:8300/health" },
  { name: "AI-Vision", url: "http://localhost:8400/health" },
  { name: "AI-Personalization", url: "http://localhost:8500/health" },
  { name: "Redis", url: "http://localhost:6379" },
  { name: "PostgreSQL", url: "http://localhost:5432" },
  { name: "Qdrant", url: "http://localhost:6333/collections" },
  { name: "Tempo OTLP", url: "http://localhost:4318/ready" },
];

(async () => {
  console.log("🚦 Checking microservice health...\n");
  for (const s of services) {
    try {
      const res = await axios.get(s.url, { timeout: 3000 });
      console.log(`✅ ${s.name.padEnd(22)} OK (${res.status})`);
    } catch {
      console.log(`❌ ${s.name.padEnd(22)} FAILED`);
    }
  }
  console.log("\n🧩 Health check completed.\n");
})();
