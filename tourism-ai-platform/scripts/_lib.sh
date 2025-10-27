#!/usr/bin/env bash
set -Eeuo pipefail

# --- Dir helpers (repo root'u bul) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Renkli log ---
log() { printf "\033[1;34m[%s]\033[0m %s\n" "$(date '+%H:%M:%S')" "$*"; }
ok()  { printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[ERR]\033[0m %s\n" "$*" >&2; }

# --- Komut / env kontrolleri ---
require_cmd(){ command -v "$1" >/dev/null 2>&1 || { err "Missing command: $1"; exit 1; }; }
require_env(){ local k="$1"; [[ -n "${!k:-}" ]] || { err "Missing env: $k"; exit 1; }; }

# --- Env yükle (.env.local varsa) ---
if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a; source "$REPO_ROOT/.env.local"; set +a
  ok "Loaded env from .env.local"
fi

# --- Varsayılan ENV (override edilebilir) ---
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tourism-postgres}"
POSTGRES_USER="${POSTGRES_USER:-ai_user}"
POSTGRES_DB="${POSTGRES_DB:-health_tourism}"
MINIO_CONTAINER="${MINIO_CONTAINER:-tourism-minio}"
DOCKER_DIR="${DOCKER_DIR:-$REPO_ROOT/infrastructure/docker}"

# --- Docker health helper'ları ---
wait_container(){
  local name="$1" timeout="${2:-90}"
  log "Waiting for container healthy: $name (timeout ${timeout}s)"
  SECS=0
  until docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null | grep -q healthy; do
    sleep 2; SECS=$((SECS+2))
    [[ $SECS -ge $timeout ]] && { err "Timeout waiting $name"; return 1; }
  done
  ok "$name healthy"
}

wait_http(){
  local url="$1" timeout="${2:-60}"
  require_cmd curl
  log "Waiting HTTP $url"
  SECS=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    sleep 2; SECS=$((SECS+2))
    [[ $SECS -ge $timeout ]] && { err "Timeout waiting $url"; return 1; }
  done
  ok "HTTP ready: $url"
}