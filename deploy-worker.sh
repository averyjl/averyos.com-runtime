#!/usr/bin/env bash
set -euo pipefail

# Build and deploy AveryOS runtime to Cloudflare Workers (production env).
# Requires Bun + Wrangler auth to already be configured.
#
# ⚠️  WARNING: This script will fail because the current build produces a Next.js
# app, not a Worker bundle. The wrangler.toml expects dist/worker.js, but
# `bun run build` (next build) does not create this file.
#
# See README.md for deployment alternatives (Vercel, Netlify, Cloudflare Pages).

bun install
bun run build
npx wrangler deploy --env production
