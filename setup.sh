#!/usr/bin/env bash
# One-shot setup for gbrain 0.59 keyless PGLite mode.
# Needs: bun, gbrain (bun install -g github:garrytan/gbrain).
# ANTHROPIC_API_KEY is only needed when brain/childhoods has no pages yet.
set -euo pipefail
cd "$(dirname "$0")"

command -v gbrain >/dev/null || { echo "gbrain not found: bun install -g github:garrytan/gbrain" >&2; exit 1; }

# Keyless local brain; skipped if one is already configured.
[ -f "${GBRAIN_HOME:-$HOME}/.gbrain/config.json" ] || gbrain init --pglite --no-embedding

# The committed pages under brain/ are the repertoire. Generate only when there are none.
if ls brain/childhoods/*.md >/dev/null 2>&1; then
  echo "brain/childhoods already has pages, skipping generation"
else
  : "${ANTHROPIC_API_KEY:?export ANTHROPIC_API_KEY first (brain/childhoods is empty, so pages must be generated)}"
  N=60 bun run generate.ts
  N=40 BASE="Lima, Peru" bun run generate.ts
fi

gbrain import ./brain --no-embed

exec bun run server.ts
