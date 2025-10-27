#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

log "Starting local backend (NestJS)..."
cd "$REPO_ROOT/backend"
yarn start:dev &
PID=$!
sleep 3
ok "Backend started (PID=$PID)"