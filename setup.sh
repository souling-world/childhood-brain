#!/usr/bin/env bash
# One-shot setup for gbrain 0.59 keyless PGLite mode.
# Needs: bun, gbrain (bun install -g github:garrytan/gbrain), ANTHROPIC_API_KEY.
set -euo pipefail
cd "$(dirname "$0")"

: "${ANTHROPIC_API_KEY:?export ANTHROPIC_API_KEY first}"
command -v gbrain >/dev/null || { echo "gbrain not found: bun install -g github:garrytan/gbrain" >&2; exit 1; }

# Keyless local brain; skipped if one is already configured.
[ -f "${GBRAIN_HOME:-$HOME}/.gbrain/config.json" ] || gbrain init --pglite --no-embedding

N=60 bun run generate.ts
N=40 BASE="Lima, Peru" bun run generate.ts

gbrain import ./brain --no-embed

exec bun run server.ts
