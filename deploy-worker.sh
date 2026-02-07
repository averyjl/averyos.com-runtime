#!/usr/bin/env bash
set -euo pipefail

# Build and deploy AveryOS runtime to Cloudflare Workers (production env).
# Requires Bun + Wrangler auth to already be configured.

bun install
bun run build

# NOTE: wrangler.toml expects dist/worker.js but the Next.js build doesn't produce it.
# Ensure the expected Worker bundle exists before deploying.
if [ ! -f dist/worker.js ]; then
  echo "Error: dist/worker.js not found. The Next.js build does not produce a Worker bundle."
  echo "To deploy to Cloudflare Workers, you need to:"
  echo "  1. Use a Cloudflare/Next adapter that outputs a Worker-compatible bundle"
  echo "  2. Or build a Worker entrypoint (e.g., with esbuild) before deploying"
  exit 1
fi

npx wrangler deploy --env production
