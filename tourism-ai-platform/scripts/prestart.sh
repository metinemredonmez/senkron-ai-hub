#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

[[ -f "$REPO_ROOT/.env.local" ]] || { err "Missing .env.local at repo root"; exit 1; }

check_port(){ local host="$1" port="$2"
  if python3 - <<PY 2>/dev/null; then echo ok >/dev/null; fi <<PY
import socket,sys
s=socket.socket(); s.settimeout(1)
try: s.connect(("$host", $port)); print("OK")
except Exception as e: sys.exit(1)
PY
}

( check_port 127.0.0.1 5432 && ok "PostgreSQL 5432 OK" ) || warn "PostgreSQL not listening 5432"
( check_port 127.0.0.1 6379 && ok "Redis 6379 OK" ) || warn "Redis not listening 6379"
( check_port 127.0.0.1 6333 && ok "Qdrant 6333 OK" ) || warn "Qdrant not listening 6333"

ok "Prestart checks done"