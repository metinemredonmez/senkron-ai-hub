#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

BACKEND="$REPO_ROOT/backend"
cd "$BACKEND"

require_cmd yarn
log "Seeding domain data..."
yarn ts-node -r tsconfig-paths/register src/scripts/seed-data.ts
ok "Seed complete"