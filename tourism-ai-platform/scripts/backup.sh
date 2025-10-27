#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

require_cmd docker
require_env POSTGRES_CONTAINER
require_env POSTGRES_USER
require_env POSTGRES_DB

TS="$(date '+%Y%m%d_%H%M%S')"
BACKUPS_DIR="$REPO_ROOT/backups"
TMP_DIR="$BACKUPS_DIR/tmp_$TS"
mkdir -p "$TMP_DIR"

log "Creating backup..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$TMP_DIR/db.sql" || {
  err "pg_dump failed"; exit 1; }
ok "DB dump saved"

if docker ps --format '{{.Names}}' | grep -q "^$MINIO_CONTAINER$"; then
  log "Copying MinIO /data..."
  docker cp "$MINIO_CONTAINER:/data" "$TMP_DIR/minio" || warn "MinIO copy skipped"
fi

ARCHIVE="$BACKUPS_DIR/backup_$TS.tar.gz"
tar -czf "$ARCHIVE" -C "$TMP_DIR" .
rm -rf "$TMP_DIR"

ok "Backup created: $ARCHIVE"