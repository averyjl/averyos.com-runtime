#!/usr/bin/env bash
set -euo pipefail

# Build and deploy AveryOS runtime to Cloudflare Workers (production env).
# Requires Bun + Wrangler auth to already be configured.

bun install
bun run build

# Validate that the expected Worker bundle exists before deploying.
# NOTE: The current build doesn't produce dist/worker.js. You need to:
# 1. Create a Worker entrypoint (e.g., src/worker.ts)
# 2. Add a build step to bundle it to dist/worker.js
# 3. Or deploy to Cloudflare Pages/Vercel/Netlify instead
if [ ! -f dist/worker.js ]; then
  echo "Error: dist/worker.js not found. Ensure your build produces dist/worker.js before deploying."
  echo "See wrangler.toml comments for guidance on Worker deployment."
  exit 1
fi

npx wrangler deploy --env production
