#!/usr/bin/env bash
set -euo pipefail

# Build and deploy AveryOS runtime to Cloudflare Workers (production env).
# Requires Bun + Wrangler auth to already be configured.

bun install
bun run build

# Ensure the expected Worker bundle exists before deploying.
if [ ! -f dist/worker.js ]; then
  echo "Error: dist/worker.js not found. Ensure your build produces dist/worker.js before deploying."
  exit 1
fi

npx wrangler deploy --env production
