#!/usr/bin/env bash
set -euo pipefail

# Build and deploy AveryOS runtime to Cloudflare Workers (production env).
# Requires Bun + Wrangler auth to already be configured.
#
# NOTE: This script runs `bun run build` (Next.js build) and then `wrangler deploy`.
# Wrangler expects a Worker bundle at `dist/worker.js` (per wrangler.toml), but
# `next build` does NOT produce that artifact. To deploy successfully, you must:
# 1. Add a Worker bundling step that outputs `dist/worker.js`, OR
# 2. Use a Next.js-to-Workers adapter/plugin that generates the Worker entrypoint.
#
# Without the Worker bundle, `wrangler deploy` will fail or deploy an incorrect artifact.

bun install
bun run build
npx wrangler deploy --env production
