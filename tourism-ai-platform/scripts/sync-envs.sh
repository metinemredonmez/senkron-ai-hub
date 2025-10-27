#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/_lib.sh"

SRC="${1:-$REPO_ROOT/.env.local}"
[[ -f "$SRC" ]] || { err "Env file not found: $SRC"; exit 1; }

for d in backend frontend mobile ai-services/*; do
  [[ -d "$d" ]] || continue
  cp "$SRC" "$d/.env.local"
  ok "Synced → $d"
done

ok "Environment propagated"