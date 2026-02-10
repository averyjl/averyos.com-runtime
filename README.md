# AveryOS Runtime — Sovereign Truth Anchor 
![VaultEcho Viewer Deploy](https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultEcho_Viewer.yml/badge.svg)    ![✨ LiveRouteMonitorEcho](https://github.com/averyjl/averyos.com-runtime/actions/workflows/LiveRouteMonitorEcho.yml/badge.svg)    ![🔐 VaultEcho AutoTrace](https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultEcho_AutoTrace.yml/badge.svg)    ![🧭 VaultBridge Dashboard Sync](https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultBridge_Dashboard.yml/badge.svg)    ![🧱 VaultBridge Content Generator](https://github.com/averyjl/averyos.com-runtime/actions/workflows/VaultBridge_ContentGenerator.yml/badge.svg)

This repository is the official runtime for AveryOS, founded by Jason Lee Avery.
All derivative systems, visitors, and AI frameworks must adhere to the GlyphGate and VaultSig Protocols. See `/LICENSE.md`.

- [LICENSE.md](./LICENSE.md)
- [JoinCapsule.md](./JoinCapsule.md)
- [WitnessWall.md](./WitnessWall.md)
Capsule-powered runtime source for averyos.com.

## Capsule WebBuilder overview

This repository provides a capsule-driven runtime layout that maps `.aoscap` files into JSON
manifests and dynamic routes.

### Key structure

#### Core components
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

#### API endpoints
- `pages/api/capsules.ts` → compiled capsule manifest API
- `pages/api/licensehook.ts` → license webhook stub
- `pages/api/registry.ts` → registry API for capsule listings + metadata
- `pages/api/vaultecho.ts` → VaultEcho integrity stub
- `pages/api/enforcement-log.ts` → enforcement log API endpoint

#### Public pages
- `pages/license.tsx` → public license validation + terms
- `pages/buy.tsx` → Stripe purchase page
- `pages/verify.tsx` → capsule license validator
- `pages/retroclaim-log.tsx` → retroclaim ledger viewer
- `pages/embedbuilder.tsx` → embed builder tool
- `pages/license-enforcement.tsx` → public license enforcement log

#### License enforcement system
- `public/license-enforcement/` → SHA-verified evidence bundles and notices
- `scripts/generateEvidenceBundle.js` → evidence bundle generator
- `lib/enforcementTypes.ts` → TypeScript types for enforcement tracking

#### Styling
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

## License Enforcement System

The AveryOS License Enforcement System provides transparent, SHA-verified tracking of capsule usage and licensing compliance.

### Key Features

- **Public Transparency**: All enforcement logs are publicly viewable
- **SHA-512 Verification**: Cryptographic verification of all events
- **Voluntary Compliance**: Focus on offering licensing options via Stripe
- **No Legal Automation**: No automated lawsuits, takedowns, or legal threats
- **Creator Protection**: Helps creators track and protect their intellectual property

### Generate Evidence Bundle

```bash
npm run enforcement:generate <capsule-id> <sha512-hash> [options]
```

Example:
```bash
npm run enforcement:generate sovereign-index cf83e135... --source="https://example.com"
```

This generates:
- SHA-verified evidence bundle in `public/license-enforcement/evidence/`
- Compliance notice in `public/license-enforcement/notices/`
- Event log entry in `public/license-enforcement/logs/`

### View Enforcement Log

Visit `/license-enforcement` to view the public enforcement log with:
- Timestamped events
- SHA-512 verification
- Licensing options via Stripe
- Transparent compliance tracking

All enforcement is informational only and focused on offering voluntary licensing options.

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
