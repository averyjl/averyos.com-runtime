# averyos.com-runtime

Capsule-powered runtime source for averyos.com.

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
- `pages/api/licensehook.ts` → license webhook stub
- `styles/globals.css` → sovereign runtime UI styling

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
