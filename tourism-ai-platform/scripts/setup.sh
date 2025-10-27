#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
declare -a WORKSPACES=("" "backend" "frontend" "mobile")

echo "▶ Cleaning workspace node_modules..."
for workspace in "${WORKSPACES[@]}"; do
  DIR="${ROOT_DIR}/${workspace}"
  if [ -d "${DIR}/node_modules" ]; then
    rm -rf "${DIR}/node_modules"
    echo "  - removed ${workspace:-root}/node_modules"
  fi
done

echo "▶ Cleaning Yarn cache (safe to ignore failures)..."
yarn cache clean >/dev/null 2>&1 || true

echo "▶ Installing root dependencies..."
yarn install --frozen-lockfile --cwd "${ROOT_DIR}"

echo "▶ Ensuring backend workspace dependencies..."
yarn install --frozen-lockfile --cwd "${ROOT_DIR}/backend"

echo "▶ Ensuring frontend workspace dependencies..."
yarn install --frozen-lockfile --cwd "${ROOT_DIR}/frontend"

cat <<'EOF'
✅ Setup finished.

Next steps:
  1) docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis tempo prometheus grafana
  2) yarn dev          # starts backend + frontend
  3) ./tools/check-health.sh
  4) yarn smoke:backend
EOF
