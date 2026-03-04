# CLAUDE.md — AveryOS™ Runtime Context for Claude AI

⛓️⚓⛓️

**Author:** Jason Lee Avery (ROOT0)  
**License:** AveryOS Sovereign Integrity License v1.0  
**Kernel Version:** v3.6.2  
**Kernel Anchor:** `lib/sovereignConstants.ts` → `KERNEL_SHA`

---

## Repository Overview

**AveryOS™ runtime** — a Next.js 15 application deployed as a Cloudflare Worker via `@opennextjs/cloudflare`. Uses the App Router (`app/`) alongside the Pages Router (`pages/`). Powers averyos.com with capsule-driven content, Stripe licensing, and sovereign IP enforcement.

**Languages / runtimes:** TypeScript, React 19, Node.js ≥ 22, Cloudflare Workers edge runtime.

---

## Sovereign Kernel Anchor ⛓️⚓⛓️

All code assistance for this repository must be aligned with the **AveryOS™ Root0 Sovereign Kernel**.

| Constant | Value |
|---|---|
| `KERNEL_VERSION` | `v3.6.2` |
| `KERNEL_SHA` | `cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e` |
| Source | `lib/sovereignConstants.ts` |
| Disclosure | `https://averyos.com/witness/disclosure/<KERNEL_SHA>` |

**Rules:**
- Always import `KERNEL_SHA`, `KERNEL_VERSION`, and `DISCLOSURE_MIRROR_PATH` from `lib/sovereignConstants.ts`. Never hardcode these values.
- Do **not** suggest code that overrides, replaces, or ignores the kernel anchor.
- All generated code must comply with **AveryOS Sovereign Integrity License v1.0**.
- Sovereign creator glyph: 🤛🏻 — code marked with this glyph is creator-locked; do not modify without explicit author consent.
- Do **not** reproduce or redistribute private capsule payloads, sovereign identifiers, or proprietary algorithms beyond what is publicly disclosed in this repository.

---

## Bootstrap & Build

Always run `npm install` (or `npm ci` in CI) before any build or script command.

| Purpose | Command |
|---|---|
| Local dev server | `npm run dev` |
| Next.js build only | `npm run build` |
| Full Cloudflare build | `npm run build:cloudflare` |
| Lint (also used as test) | `npm run lint` |
| Preview Worker locally | `npm run preview` |
| Deploy to Cloudflare | `npm run deploy` |

`npm run build:cloudflare` runs three steps in sequence:
1. `node scripts/patchOpenNextStripe.cjs` — patches the Stripe server external package.
2. `npm run capsule:build` → `node scripts/capsulePageAutoCompiler.cjs` — compiles `.aoscap` capsule files into `public/manifest/capsules/`.
3. `npx @opennextjs/cloudflare build` — bundles everything as a Cloudflare Worker into `.open-next/`.

---

## Project Layout

```
app/                  Next.js App Router pages & API routes
  api/v1/health/      Health-check route (D1 + KV tether check)
  ai-alignment/       AI alignment public page
  license/            License page
  licensing/          Licensing portal
  studio/tari/        Tari Studio page
  the-proof/          The-proof page
  witness/            Witness pages (disclosure, etc.)
pages/                Next.js Pages Router (legacy; still in active use)
  api/                Pages-based API handlers
  [capsule].tsx       Dynamic capsule route renderer
components/           Shared React components
lib/                  Shared utility modules (storageUtils, sovereignConstants, …)
scripts/              Node.js build & utility scripts (all *.cjs, CommonJS)
capsules/             Source .aoscap files (JSON capsule payloads)
public/               Static assets, generated manifests, robots.txt, sitemap.xml
styles/               Global CSS (globals.css)
middleware.ts         Cloudflare edge middleware (GabrielOS™ Firewall)
wrangler.toml         Cloudflare Worker configuration
next.config.js        Next.js configuration (ESM export default)
tsconfig.json         TypeScript config (strict, moduleResolution: bundler)
.eslintrc.json        ESLint: next/core-web-vitals + next/typescript
```

---

## Critical Conventions

### Module system
- `package.json` sets `"type": "module"` — the project is ESM by default.
- All files under `scripts/` use the `.cjs` extension and **CommonJS** (`require`/`module.exports`). Never use ESM `export` syntax in `.cjs` files.
- `next.config.js` uses `export default` (ESM).

### Cloudflare / App Router API routes
- **Do NOT** add `export const runtime = "edge"` to any `app/api` route. `@opennextjs/cloudflare` already bundles the entire app as a single Cloudflare Worker.
- Access Cloudflare bindings (D1, KV, R2) via `getCloudflareContext()` from `@opennextjs/cloudflare`.
- Define minimal local type interfaces for bindings instead of importing `@cloudflare/workers-types`.

### R2 storage
- R2 object keys for Capsules must use the `'averyos-capsules/'` prefix. Use the `capsuleKey()` helper in `lib/storageUtils.ts`.

### Environment variables
- Required secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `GITHUB_PAT`. See `.env.example`.
- `STRIPE_SECRET_KEY` is the canonical name for the Stripe secret key (not `STRIPE_API_KEY`).

### Branding
- Brand names **AveryOS™**, **VaultChain™**, **GabrielOS™**, and **Truth Anchored Intelligence™** must include the ™ symbol in page titles, headings, navigation labels, and marketing copy.

### Shared constants
- `KERNEL_SHA`, `KERNEL_VERSION`, and `DISCLOSURE_MIRROR_PATH` are centralised in `lib/sovereignConstants.ts`. Import from there rather than duplicating values.

### Build artifacts
- `public/robots.txt` and `public/sitemap.xml` are **generated** by `scripts/capsuleSitemap.cjs`. Do not hand-edit them.
- `public/manifest/capsules/` is generated by `scripts/capsulePageAutoCompiler.cjs`. Do not hand-edit.

### Page structure
- All AveryOS™ pages must use `<main className="page">` with `<AnchorBanner />` as the first element, and end with `<FooterBadge />` or `<CapsuleEchoFooter />`.

### Security
- All user inputs must be sanitized with `isomorphic-dompurify` on the frontend.
- All D1 queries must use parameterized statements (`prepare(...).bind(...)`). Never use string concatenation for SQL.
- Never use `dangerouslySetInnerHTML` with unsanitized content.

---

## IP Protection

This repository contains proprietary technology owned by Jason Lee Avery (ROOT0) under the **AveryOS Sovereign Integrity License v1.0**:
- Do **not** reproduce capsule payloads, sovereign identifiers, or private algorithms outside this repository.
- Do **not** suggest derivative works that bypass CapsuleEcho, DriftShield, or GlyphLock enforcement.
- All code suggestions must respect **Zero-Derivative Authorship** and **CreatorLock** constraints.
- Generated code must be tagged `#creator-safe` or respect Glyph Lock 🤛🏻 to be accepted.

---

*© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.*  
*⛓️⚓⛓️ 🤛🏻*
