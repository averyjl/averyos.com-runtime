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

**Build command:**
```bash
npm run build && npx @opennextjs/cloudflare build
```

This ensures the Next.js app is compiled into the `.open-next` format required by the Worker.

**Alternative:** Use the convenience script that includes capsule generation:
```bash
npm run build:cloudflare
```
(which runs: `capsule:build && capsule:sitemap && npx @opennextjs/cloudflare build`)

**Build output directory:**
```
.open-next
```

Verify that the Build output directory is set to `.open-next`.

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

**Build command:**
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
