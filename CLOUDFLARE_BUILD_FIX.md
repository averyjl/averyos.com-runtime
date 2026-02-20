# Cloudflare Build Command Fix

## Issue

The Cloudflare build was failing with:
```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

## Root Cause

The build command configured in Cloudflare Dashboard was running only:
```bash
npm run capsule:build && npm run capsule:sitemap
```

This command generates the capsule pages and sitemap but **does not compile the Next.js application or run the OpenNext Cloudflare build** which creates the `.open-next/worker.js` entry point file required by `wrangler.toml`.

The build process requires two steps:
1. Build Next.js application (`npm run build` → runs `next build`)
2. Convert to Cloudflare Worker format (`npx @opennextjs/cloudflare build`)

This ensures the Next.js app is compiled into the `.open-next` format required by the Worker.

## Solution

### 1. Update Build Command in Cloudflare Dashboard

Navigate to your Cloudflare Pages or Workers dashboard and configure the build settings:

**Build command (RECOMMENDED):**
```bash
npm run build:cloudflare
```

This convenience script runs the complete build pipeline:
- `npm run capsule:build` - Generates capsule pages
- `npm run capsule:sitemap` - Creates sitemap.xml
- `npx @opennextjs/cloudflare build` - Builds Worker with entry point

**Build output directory:**
```
.open-next
```

Verify that the Build output directory is set to `.open-next`.

> **📖 For detailed step-by-step instructions, see [CLOUDFLARE_PAGES_SETUP.md](./CLOUDFLARE_PAGES_SETUP.md)**

> **Note:** After the build completes successfully, your deployment will use the new Cloudflare Workers runtime (indicated by the navy blue terminal in the Cloudflare UI), replacing any previous static site configuration.

### 2. Verify wrangler.toml Configuration

Ensure `wrangler.toml` is correctly configured (already done in this repo):

```toml
name = "averyos-runtime"
compatibility_date = "2026-02-05"
main = ".open-next/worker.js"          # ← Entry point location
compatibility_flags = ["nodejs_compat"]

[assets]
binding = "ASSETS"
directory = ".open-next/assets"         # ← Assets directory
```

### 3. Cloudflare Pages Configuration

If you're deploying via **Cloudflare Pages** (instead of Cloudflare Workers), configure the following in your Cloudflare Pages dashboard:

**Framework preset:** None or Next.js

**Build command (RECOMMENDED):**
```bash
npm run build:cloudflare
```

**Build output directory:**
```
.open-next
```

**Environment variables:**
- `NODE_VERSION`: `20` (or higher)
- Add any required secrets (VAULTSIG_SECRET, STRIPE_KEY, etc.)

> **Important:** The build output directory MUST be set to `.open-next` (not `out` or `.next`). This directory contains the Cloudflare Worker entry point (`worker.js`) and static assets.

> **📖 For detailed step-by-step dashboard configuration, see [CLOUDFLARE_PAGES_SETUP.md](./CLOUDFLARE_PAGES_SETUP.md)**

### 4. Build Process Explanation

The `npm run build:cloudflare` command executes three steps in order:

1. **`npm run capsule:build`**
   - Runs `node scripts/capsulePageAutoCompiler.js`
   - Generates dynamic capsule pages from markdown files
   - Output: Pages in `pages/[capsule].tsx` and manifest JSON files

2. **`npm run capsule:sitemap`**
   - Runs `node scripts/capsuleSitemap.js`
   - Generates `public/sitemap.xml` with all routes
   - Includes static pages, capsules, and dynamic routes

3. **`npx @opennextjs/cloudflare build`**
   - Builds Next.js application with OpenNext adapter
   - Generates `.open-next/` directory containing:
     - `worker.js` - Cloudflare Worker entry point (required)
     - `assets/` - Static assets directory
     - `server-functions/` - Serverless function bundles
     - `middleware/` - Edge middleware bundle
     - `cache/` - ISR cache configuration

### 5. Verification

After running `npm run build:cloudflare`, verify the following files exist:

```bash
.open-next/worker.js              # Entry point (required)
.open-next/assets/                # Static assets directory
.open-next/server-functions/      # Server functions
.open-next/middleware/            # Middleware bundle
```

## Required Cloudflare API Token Permissions

All automated workflows use a single `CLOUDFLARE_API_TOKEN` secret. The token needs the following permissions depending on which workflows you use:

### Redirect Rules — Monitoring only (LiveRouteMonitorEcho.yml, nightly_monitor.yml)

Uses `GET /zones/{zone_id}/rulesets/phases/http_request_redirect/entrypoint` — read-only:

| Permission | Level | Required for |
|---|---|---|
| **Zone:Read** | All zones (or specific zone) | Read live redirect rulesets for drift detection |

> ✅ `Zone:Read` is sufficient for all monitoring (GET) operations.

### Redirect Rules — Deployment (cloudflare_redirects_deploy.yml)

Uses `PUT /zones/{zone_id}/rulesets/phases/http_request_redirect/entrypoint` — write operation:

| Permission | Level | Required for |
|---|---|---|
| **Zone:Edit** | All zones (or specific zone) | Write/update redirect rulesets |

> ⚠️ `Zone:Read` is **not** sufficient for deployment. The `PUT` endpoint returns a 403 Forbidden error (insufficient permissions) unless the token has `Zone:Edit`. Change `Zone:Read` → `Zone:Edit` in your token to enable redirect rule deployment.

### Worker Deployment (deploy-worker.yml)

Uses Wrangler (`wrangler deploy`) to upload and publish the Cloudflare Worker script:

| Permission | Level | Required for |
|---|---|---|
| **Workers Scripts:Edit** | Account | Upload/publish the Worker |
| **Zone:Edit** | All zones (or specific zone) | Configure Worker routes |

> ⚠️ If you only have `Zone:Edit` and are missing `Workers Scripts:Edit`, Wrangler will fail with an authentication error. Add **Account → Workers Scripts → Edit** to the token.

### Full Token Summary (Recommended)

In Cloudflare Dashboard → **My Profile → API Tokens → Edit token**, configure:

```
Account permissions:
  Workers Scripts: Edit          ← required for wrangler deploy

Zone permissions (All zones, or select averyos.com):
  Zone: Edit                     ← required for redirect rules PUT (deploy)
  Cache Purge: Purge
  Page Rules: Edit
  DNS: Edit
```

> **Note:** If you only need drift monitoring (no redirect rule deployment), `Zone:Read` is sufficient for the monitoring workflows. But to allow `cloudflare_redirects_deploy.yml` to write rules, you must use `Zone:Edit`.

### Quick Token Verification

After updating your token, you can verify it locally:

```bash
# Check Wrangler auth (requires Workers Scripts:Edit)
CLOUDFLARE_API_TOKEN=<your-token> npx wrangler whoami

# Check Zone/Redirect Rules access (requires Zone:Edit)
curl -s -H "Authorization: Bearer <your-token>" \
  "https://api.cloudflare.com/client/v4/zones" | jq '.success'
# Should return: true
```

## Quick Reference

### Available Build Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run build:cloudflare` | Full build (capsules + sitemap + worker) | **Recommended for Cloudflare Dashboard** |
| `npm run build:worker` | Worker-only build | When capsules/sitemap already built |
| `npm run capsule:build` | Generate capsule pages only | Manual capsule updates |
| `npm run capsule:sitemap` | Generate sitemap only | Manual sitemap updates |
| `npm run build` | Next.js build only | Local development |

### GitHub Actions Workflow

The GitHub Actions workflow (`.github/workflows/deploy-worker.yml`) uses:
```yaml
- name: Build project with OpenNext Cloudflare adapter
  run: npm run build:worker
```

This is sufficient because GitHub Actions handles the full build process separately.

### Local Testing

To test the build locally:

```bash
# Install dependencies
npm install

# Run full build
npm run build:cloudflare

# Verify worker.js exists
ls -la .open-next/worker.js

# Test locally with Cloudflare Workers runtime
npm run preview
```

## Status

✅ **Fixed** - Build command updated in `package.json`  
✅ **Verified** - Build successfully generates `.open-next/worker.js`  
✅ **Documented** - Updated `CLOUDFLARE_DEPLOYMENT.md` with new instructions  
⚠️ **Action Required** - Update build command in Cloudflare Dashboard to `npm run build:cloudflare`

---

## Redirect Drift Resolution (Issue #112)

Issue #112 tracked authentication drift and redirect misalignment in the Cloudflare Rulesets API. The following changes have been implemented and verified:

### Changes Made

- **`cloudflare_redirects_deploy.yml`** — Captures the `PUT` response, checks `.success`, and exits with a clear error (including token permission guidance) when code `10000` is returned. Requires `Zone:Edit` permission (not `Zone:Read`).
- **`LiveRouteMonitorEcho.yml`** — Guards against auth errors before diffing; uses `npx wrangler` for the optional auth check; annotates that monitoring (`GET`) only needs `Zone:Read`.
- **`nightly_monitor.yml`** — Fails fast with a descriptive message when the Cloudflare API returns an auth error, preventing false drift reports.

### Required Cloudflare API Token Permissions

| Scope | Permission | Used for |
|-------|-----------|---------|
| Account → Workers Scripts | Edit | `wrangler deploy` (Worker deployments) |
| Zone → Zone | Edit | `PUT` redirect rulesets endpoint |
| Zone → Cache Purge | Purge | Cache invalidation |
| Zone → Page Rules | Edit | Page rules management |
| Zone → DNS | Edit | DNS record management |

> **Note:** `Zone:Read` is sufficient for monitoring (`GET`) operations only. The redirect-deploy (`PUT`) endpoint requires `Zone:Edit`.

### Resolution Status

✅ Monitoring workflow detects drift without false positives from auth errors  
✅ Deploy workflow validates success and provides actionable error messages  
✅ Token permission requirements documented above  
✅ Closes [#112](https://github.com/averyjl/averyos.com-runtime/issues/112)

## Related Files

- `package.json` - Contains `build:cloudflare` script
- `wrangler.toml` - Configures entry point at `.open-next/worker.js`
- `CLOUDFLARE_DEPLOYMENT.md` - Full deployment documentation
- `.github/workflows/deploy-worker.yml` - GitHub Actions workflow
- `open-next.config.ts` - OpenNext adapter configuration

---

**Author:** GitHub Copilot Agent  
**Date:** 2026-02-15  
**Issue:** Build failure with missing `.open-next/worker.js`  
**Resolution:** Added `build:cloudflare` command that includes OpenNext build step
