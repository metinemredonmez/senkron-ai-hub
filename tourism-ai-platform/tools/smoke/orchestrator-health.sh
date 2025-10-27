#!/usr/bin/env bash
set -euo pipefail

curl -sf http://localhost:8080/health >/dev/null
curl -sf http://localhost:8080/metrics >/dev/null
echo "Orchestrator health checks passed."
