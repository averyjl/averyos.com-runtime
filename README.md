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

## Cloudflare Workers deploy (Bun)

1. Set Worker secrets in Cloudflare and GitHub Actions:
   - `VAULTSIG_SECRET`
   - `STRIPE_KEY`
2. Ensure Wrangler is authenticated.
3. Run local deploy helper:

```bash
./deploy-worker.sh
```

Or deploy directly:

```bash
npx wrangler deploy --env production
```
