#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

require_cmd docker
require_cmd docker-compose || true # docker compose v2 ise sorun değil

log "Installing JS deps (root)..."
require_cmd yarn
yarn install --frozen-lockfile

log "Copying env templates..."
for d in backend frontend mobile ai-services/*; do
  [[ -d "$d" ]] || continue
  [[ -f "$d/.env.local" ]] || [[ ! -f "$d/.env.example" ]] || cp "$d/.env.example" "$d/.env.local"
  ok "Env ensured for $d"
done

log "Bringing up Docker infra..."
cd "$DOCKER_DIR"
docker compose up -d postgres redis qdrant minio zookeeper kafka grafana prometheus loki tempo

wait_container tourism-local-postgres || true
wait_container tourism-local-redis || true
wait_container docker-local-zookeeper || true
wait_container docker-local-kafka || true
wait_http http://localhost:9090/-/healthy || true
wait_http http://localhost:3100/ready || true

cd "$REPO_ROOT/scripts"
./migrate-db.sh

ok "Local setup complete → Frontend: http://localhost:3000"