#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

require_env POSTGRES_CONTAINER
require_env POSTGRES_USER
require_env POSTGRES_DB

SRC="${1:-}"
[[ -n "$SRC" ]] || { err "Usage: $0 <backup.tar.gz|dump.sql>"; exit 1; }

TMP="$REPO_ROOT/backups/restore_tmp"
rm -rf "$TMP"; mkdir -p "$TMP"

if [[ "$SRC" == *.tar.gz ]]; then
  log "Extracting $SRC..."
  tar -xzf "$SRC" -C "$TMP"
  SQL_FILE="$TMP/db.sql"
else
  SQL_FILE="$SRC"
fi

[[ -f "$SQL_FILE" ]] || { err "SQL not found"; exit 1; }

log "Restoring PostgreSQL..."
docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SQL_FILE" || {
  err "Restore failed"; exit 1; }
ok "Restore complete"