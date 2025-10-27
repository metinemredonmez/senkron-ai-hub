#!/usr/bin/env bash
set -euo pipefail

curl -sf http://localhost:4000/api/health >/dev/null
curl -sf http://localhost:4000/api/hub/metrics >/dev/null
echo "Backend health checks passed."
