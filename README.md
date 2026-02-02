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

### Run locally

```bash
npm install
npm run dev
```

### Public repo hygiene

- Keep secrets out of the repo. Store API keys in `.env` files (ignored by git) or your deployment
  platform’s secret manager.
- Use placeholder domains in sample capsules unless you intend to publish the endpoint publicly.
