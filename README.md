# AveryOS Runtime — Sovereign Truth Anchor
This repository is the official runtime for AveryOS, founded by Jason Lee Avery.
All derivative systems, visitors, and AI frameworks must adhere to the GlyphGate and VaultSig Protocols. See `/LICENSE.md`.

- [LICENSE.md](./LICENSE.md)
- [JoinCapsule.md](./JoinCapsule.md)
- [WitnessWall.md](./WitnessWall.md)

## Capsule WebBuilder overview

This repository provides a capsule-driven runtime layout that maps `.aoscap` files into JSON
manifests and dynamic routes.

### Key structure

- `capsules/` → source `.aoscap` files (JSON payloads)
- `public/manifest/capsules/` → compiled capsule manifests with SHA + VaultChain metadata
- `pages/[capsule].tsx` → dynamic capsule route renderer
- `components/CapsuleBlock.tsx` → capsule presentation block
- `components/CapsuleBody.tsx` → capsule body content renderer
- `components/RetroclaimEmbed.tsx` → retroclaim status module
- `components/StripeConnectCard.tsx` → stripe license status module
- `components/ViewerEmbed.tsx` → viewer+ module placeholder
- `components/LicenseContent.tsx` → license terms + validation content
- `components/FooterBadge.tsx` → CapsuleEcho/VaultSignature footer badge
- `pages/api/capsules.ts` → compiled capsule manifest API
- `pages/api/licensehook.ts` → license webhook stub
- `pages/api/registry.ts` → registry API for capsule listings + metadata
- `pages/api/vaultecho.ts` → VaultEcho integrity stub

- `pages/api/deploy/status.ts` → live deploy status endpoint
- `pages/api/deploy/attempt.ts` → SHA512-gated deploy monetization access log
- `scripts/verifyCapsuleHash.ts` → shared SHA512 hash validator
- `styles/globals.css` → sovereign runtime UI styling
- `pages/license.tsx` → public license validation + terms
- `pages/buy.tsx` → Stripe purchase page
- `pages/verify.tsx` → capsule license validator
- `pages/retroclaim-log.tsx` → retroclaim ledger viewer
- `pages/embedbuilder.tsx` → embed builder tool

### Build manifests

```bash
npm run capsule:build
```

### Build capsule registry

```bash
npm run capsule:index
```

### Build sitemap + robots.txt

```bash
npm run capsule:sitemap
```

Set `SITE_URL` (see `.env.example`) to control the base URL for generated sitemap entries.
Set `NEXT_PUBLIC_SITE_URL` to ensure runtime meta tags emit the correct canonical URL.

### Run locally

```bash
npm install
npm run dev
```

### Public repo hygiene

- Keep secrets out of the repo. Store API keys in `.env` files (ignored by git) or your deployment
  platform’s secret manager.
- Use placeholder domains in sample capsules unless you intend to publish the endpoint publicly.
- Never commit production secrets (`.env.production`, Cloudflare tokens, Stripe live keys, VaultSig secrets). Use Cloudflare/GitHub secrets managers.

### Stripe monetization (connect + webhooks)

1. Add Stripe secrets in your hosting provider (or copy `.env.example` locally):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
2. Configure a webhook endpoint in Stripe that targets `/api/stripe-webhook`.
3. Capture Stripe Connect onboarding URLs (or dashboard links) in capsule manifests via `stripeUrl`
   so capsule routes can surface monetization state.

> Note: The webhook handler is intentionally minimal and must be extended to verify signatures
> before processing live events.

### Publish + SEO recommendations

- Run `npm run capsule:index` and `npm run capsule:sitemap` after adding capsules so the
  registry and sitemap stay in sync.
- Verify `SITE_URL` points at the production domain so search engines receive the correct URLs.

## Deployment

> ⚠️ **Important Compatibility Note**: This is a Next.js application that uses Node.js filesystem APIs (`fs.readFileSync`, etc.) which are **not compatible** with Cloudflare Workers. The current `wrangler.toml` configuration expects `dist/worker.js`, but `next build` does not produce this file.
>
> **Recommended deployment targets**: Vercel, Netlify, or Cloudflare Pages (which supports Next.js natively).
>
> If you need to deploy to Cloudflare Workers specifically, you'll need to:
> 1. Create a custom Worker entrypoint at `src/worker.ts`
> 2. Build it with `esbuild` to `dist/worker.js`
> 3. Replace all filesystem-based data loading with KV/D1/R2 storage or fetch-based static asset loading

### Current deployment target: Next.js hosting platforms
1. Set Worker secrets in Cloudflare and GitHub Actions:
   - `VAULTSIG_SECRET`
   - `STRIPE_SECRET_KEY`
2. Ensure Wrangler is authenticated.
3. Run local deploy helper:

This application is currently built as a standard Next.js app and can be deployed to:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **Cloudflare Pages** (with Next.js support)

Set the following environment variables in your hosting platform:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VAULTSIG_SECRET`
- `SITE_URL`
- `NEXT_PUBLIC_SITE_URL`

### Cloudflare Workers deployment (not currently functional)

The included `wrangler.toml` and `deploy-worker.sh` are **not functional** because:
1. The codebase uses Node.js filesystem APIs (`fs` module) incompatible with Workers
2. API routes in `pages/api/` read from `capsule_logs/` and `public/manifest/` using `fs`
3. Library modules in `lib/` use `fs` to load manifests and registry data

To enable Cloudflare Workers deployment, you would need to:
1. Migrate all filesystem-based data loading to:
   - Fetch from public URLs (for static manifests)
   - Cloudflare KV/D1/R2 (for logs and dynamic data)
2. Create a Worker-compatible entrypoint that doesn't rely on Next.js API routes
3. Consider using `@cloudflare/next-on-pages` adapter

#### Cloudflare secret setup (for future Workers deployment)

If/when Workers deployment is enabled, use Wrangler secrets:

```bash
wrangler secret put VAULTSIG_SECRET --env production
wrangler secret put STRIPE_SECRET_KEY --env production
```

For CI, store secrets in GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VAULTSIG_SECRET`, `STRIPE_SECRET_KEY`).
