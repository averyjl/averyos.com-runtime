#!/usr/bin/env bash
set -euo pipefail

# Build and deploy AveryOS runtime to Cloudflare Workers (production env).
# Requires Bun + Wrangler auth to already be configured.

bun install
bun run build

# Ensure the expected Worker bundle exists before deploying.
if [ ! -f dist/worker.js ]; then
  echo "Error: dist/worker.js not found. Ensure your build produces dist/worker.js before deploying."
  echo "The current build runs 'next build' which produces a Next.js app, not a Worker bundle."
  echo "Consider adding a Worker entrypoint or using a Next.js Cloudflare adapter."
  exit 1
fi

npx wrangler deploy --env production
