# Cloudflare Pages Setup Guide

## 🔧 Critical Configuration for Cloudflare Dashboard

This guide provides the **exact settings** needed to configure your Cloudflare Pages deployment to successfully generate the `.open-next/worker.js` entry point.

---

## ⚡ Quick Setup (Cloudflare Pages Dashboard)

Navigate to your Cloudflare Pages project → **Settings** → **Build & deployments**

### Required Settings

**Framework preset:**
```
None
```

**Build command:**
```bash
npm run build:cloudflare
```

**Build output directory:**
```
.open-next
```

**Node.js version:** (Environment Variables)
```
NODE_VERSION=20
```

---

## 🔍 Why These Settings Matter

### Build Command Breakdown

The `npm run build:cloudflare` command executes three critical steps:

```bash
npm run capsule:build && npm run capsule:sitemap && npx @opennextjs/cloudflare build
```

1. **`npm run capsule:build`**
   - Generates dynamic capsule pages from `.aoscap` markdown files
   - Creates capsule manifest in `public/manifest/capsules/`

2. **`npm run capsule:sitemap`**
   - Generates `public/sitemap.xml` with all routes
   - Includes capsules, static pages, and dynamic routes

3. **`npx @opennextjs/cloudflare build`**
   - **This is the critical step** that generates `.open-next/worker.js`
   - Converts Next.js app into Cloudflare Worker format
   - Creates the complete `.open-next/` directory structure

### Why `.open-next/worker.js` is Required

The `wrangler.toml` configuration specifies:
```toml
main = ".open-next/worker.js"
```

Without this file, Cloudflare cannot deploy your Worker, resulting in:
```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

---

## 🚨 Common Mistakes to Avoid

### ❌ INCORRECT Build Commands

These commands will **NOT** generate the Worker entry point:

```bash
# Missing the OpenNext build step
npm run capsule:build && npm run capsule:sitemap

# Missing "build" subcommand (invalid)
npm run capsule:build && npm run capsule:sitemap && npx @opennextjs/cloudflare

# Only builds Next.js but doesn't convert to Worker format
npm run build
```

### ✅ CORRECT Build Command

```bash
npm run build:cloudflare
```

This is the **only** command that includes all three required steps.

---

## 📋 Step-by-Step Configuration

### 1. Access Cloudflare Pages Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Select your project (e.g., `averyos-runtime`)
4. Go to **Settings** → **Build & deployments**

### 2. Update Build Configuration

Click **Edit configuration** and enter:

| Setting | Value |
|---------|-------|
| **Framework preset** | None |
| **Build command** | `npm run build:cloudflare` |
| **Build output directory** | `.open-next` |
| **Root directory (optional)** | *(leave blank)* |

### 3. Configure Environment Variables

Go to **Settings** → **Environment variables** and add:

| Variable | Value | Note |
|----------|-------|------|
| `NODE_VERSION` | `20` | Required for Node.js 20+ support |
| `VAULTSIG_SECRET` | *(your secret)* | VaultChain operations |
| `STRIPE_KEY` | *(your key)* | Payment processing |

### 4. Save and Trigger Deployment

1. Click **Save** to apply the new build configuration
2. Go to **Deployments** tab
3. Click **Retry deployment** or push a new commit to trigger a build

### 5. Verify Successful Build

After the build completes, check the build logs for:

```
✓ Capsule manifest generated
✓ Sitemap created (6 URLs)
✓ Next.js build complete
✓ OpenNext Cloudflare adapter executed
✓ .open-next/worker.js created
```

The deployment should show:
- **Status:** Deployed
- **Environment:** Production
- **Runtime:** Cloudflare Workers (navy blue terminal indicator)

---

## 🧪 Local Testing

To test the build locally before deploying:

```bash
# Install dependencies
npm install

# Run the complete build
npm run build:cloudflare

# Verify worker.js exists
ls -la .open-next/worker.js

# Preview with Cloudflare Workers runtime
npm run preview
```

Expected output:
```
.open-next/worker.js         # Entry point (required)
.open-next/assets/           # Static assets
.open-next/server-functions/ # Serverless functions
.open-next/middleware/       # Edge middleware
.open-next/cache/            # ISR cache config
```

---

## 🔄 Alternative Build Commands

For advanced use cases:

### Option 1: Explicit Command Chain
```bash
npm run build && npx @opennextjs/cloudflare build
```
*Use when capsules/sitemap are already generated*

### Option 2: Full Manual Chain
```bash
npm run capsule:build && npm run capsule:sitemap && npx @opennextjs/cloudflare build
```
*Equivalent to `npm run build:cloudflare`*

---

## 📊 Build Output Verification

After a successful build, the `.open-next/` directory should contain:

```
.open-next/
├── worker.js                    ← Entry point (REQUIRED)
├── assets/                      ← Static files
│   ├── _next/
│   ├── images/
│   └── manifest/
├── server-functions/            ← Serverless function bundles
│   └── default/
├── middleware/                  ← Edge middleware bundle
│   └── middleware.mjs
└── cache/                       ← ISR cache configuration
    └── __cache.json
```

**Critical Files:**
- ✅ `worker.js` - Cloudflare Worker entry point
- ✅ `assets/` - Static asset directory
- ✅ `server-functions/default/` - Server-side rendering functions

---

## 🎯 Deployment Success Indicators

### Cloudflare Dashboard Indicators

- **Build Status:** ✅ Success (green checkmark)
- **Build Time:** ~2-4 minutes
- **Deploy Status:** ✅ Active
- **Preview URL:** `https://[hash].averyos-runtime.pages.dev`
- **Production URL:** `https://averyos.com`

### Runtime Indicators

- **Worker Runtime:** Active (navy blue terminal in UI)
- **Cache Rate:** Should increase after deployment
- **Response Time:** Edge optimized (<50ms for static assets)

---

## 🐛 Troubleshooting

### Issue: "Entry-point file was not found"

**Symptoms:**
```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

**Solution:**
1. Verify build command is exactly: `npm run build:cloudflare`
2. Check that build output directory is set to `.open-next`
3. Ensure Node.js version is set to 20 or higher
4. Review build logs for errors in the OpenNext step

### Issue: Build succeeds but deployment fails

**Solution:**
1. Check `wrangler.toml` configuration
2. Verify environment variables are set correctly
3. Review Cloudflare account permissions

### Issue: Old static site still showing

**Symptoms:**
- White page showing instead of navy blue terminal
- DNS changes not reflected

**Solution:**
1. Clear Cloudflare cache: **Caching** → **Configuration** → **Purge Everything**
2. Wait 5-10 minutes for global CDN propagation
3. Test with `curl -I https://averyos.com` to verify headers

---

## 📚 Related Documentation

- [CLOUDFLARE_BUILD_FIX.md](./CLOUDFLARE_BUILD_FIX.md) - Detailed build troubleshooting
- [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) - OpenNext adapter overview
- [README.md](./README.md#cloudflare-deployment) - Quick reference
- [wrangler.toml](./wrangler.toml) - Worker configuration

---

## 📞 Support

If you encounter issues after following this guide:

1. Check build logs in Cloudflare Dashboard → Deployments → View Build Logs
2. Review [OpenNext Cloudflare Documentation](https://opennext.js.org/cloudflare)
3. Verify GitHub Actions workflow is passing: `.github/workflows/deploy-worker.yml`

---

**Status:** ✅ Verified Configuration  
**Last Updated:** 2026-02-15  
**Next.js Version:** 15.5.12  
**OpenNext Version:** 1.16.5
