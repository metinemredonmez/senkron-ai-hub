#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
TENANT="${TENANT:-demo-tenant}"

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ curl is required to run this script" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required to parse JSON responses" >&2
  exit 1
fi

echo "▶ Backend URL: ${BACKEND_URL}"
echo "▶ Tenant: ${TENANT}"

echo "▶ Checking backend health..."
curl -sf -H "X-Tenant: ${TENANT}" "${BACKEND_URL}/api/health" | jq .

echo "▶ Checking Swagger docs metadata..."
curl -sf "${BACKEND_URL}/api/docs-json" | jq '.info.title, .paths | keys[0:5]'

echo "✅ Health checks passed."
