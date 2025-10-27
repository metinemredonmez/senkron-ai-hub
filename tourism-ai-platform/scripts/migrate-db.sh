#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

BACKEND="$REPO_ROOT/backend"
cd "$BACKEND"

require_cmd yarn

[[ -f "dist/database/data-source.js" ]] || { log "Building backend..."; yarn build; }

log "Running TypeORM migrations..."
yarn typeorm migration:run -d dist/database/data-source.js
ok "Migrations complete"