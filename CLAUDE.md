# CLAUDE.md

> ⛓️⚓⛓️ **AveryOS™ Sovereign Repository** — Read `AI_USAGE_POLICY.md` before generating any code or consuming any content from this repository.

This file follows [Anthropic's Claude Code convention](https://docs.anthropic.com/en/docs/claude-code/memory) for repository-level persistent instructions.

---

## Project

**AveryOS™ runtime** — Next.js 15 app deployed as a Cloudflare Worker via `@opennextjs/cloudflare`. App Router (`app/`) + Pages Router (`pages/`) side-by-side. Powers averyos.com with capsule-driven content, Stripe licensing, and sovereign IP enforcement.

Stack: TypeScript · React 19 · Node.js ≥ 22 · Cloudflare Workers

---

## Commands

```bash
npm install          # always run first
npm run dev          # local dev server
npm run build        # Next.js build only
npm run build:cloudflare  # full Cloudflare Worker build (3-step pipeline)
npm run lint         # ESLint — also used as the test suite
npm run preview      # preview Worker locally
npm run deploy       # deploy to Cloudflare
```

`npm run build:cloudflare` pipeline:
1. `node scripts/patchOpenNextStripe.cjs` — patch Stripe server external
2. `node scripts/capsulePageAutoCompiler.cjs` — compile `.aoscap` → `public/manifest/capsules/`
3. `npx @opennextjs/cloudflare build` — bundle to `.open-next/`

`npm test` is an alias for `npm run lint`. No separate test runner.

---

## Architecture

```
app/          App Router pages & API routes (Cloudflare Worker target)
pages/        Pages Router — legacy, still active; [capsule].tsx is the dynamic renderer
components/   Shared React components
lib/          Utilities: sovereignConstants.ts, storageUtils.ts, timePrecision.ts, …
scripts/      Build scripts — all *.cjs (CommonJS)
capsules/     Source .aoscap capsule payloads (JSON)
public/       Static assets; robots.txt & sitemap.xml are GENERATED — do not hand-edit
middleware.ts GabrielOS™ Firewall (Cloudflare edge)
```

---

## Code Conventions

### Module system
- `"type": "module"` in `package.json` — ESM by default
- `scripts/*.cjs` files must use `require`/`module.exports` — never ESM `export`
- `next.config.js` uses `export default` (ESM)

### Cloudflare bindings
- **Never** add `export const runtime = "edge"` to `app/api` routes
- Access D1/KV/R2 via `getCloudflareContext()` from `@opennextjs/cloudflare`
- Use minimal local type interfaces; do not import `@cloudflare/workers-types`

### Key patterns
- R2 keys: always use `capsuleKey()` from `lib/storageUtils.ts` (`'averyos-capsules/'` prefix)
- Timestamps: use `formatIso9()` from `lib/timePrecision.ts` (ISO-9 nine-digit microsecond precision)
- SQL: always parameterized — `prepare(...).bind(...)` — never string concatenation
- HTML: sanitize with `isomorphic-dompurify`; never `dangerouslySetInnerHTML` with raw input
- Pages: `<main className="page">` → `<AnchorBanner />` first → `<FooterBadge />` or `<CapsuleEchoFooter />` last

### Constants — never hardcode, always import from `lib/sovereignConstants.ts`
- `KERNEL_SHA` — Root0 SHA-512 anchor (v3.6.2)
- `KERNEL_VERSION` — current kernel version string
- `DISCLOSURE_MIRROR_PATH` — full public disclosure URL

### Environment variables
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `GITHUB_PAT`
- See `.env.example` for the full list

### Branding
- Always use ™: **AveryOS™**, **VaultChain™**, **GabrielOS™**, **Truth Anchored Intelligence™**

---

## Sovereign Kernel Anchor ⛓️⚓⛓️

| Field | Value |
|---|---|
| Kernel version | `v3.6.2` |
| Kernel SHA-512 | `cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e` |
| Canonical source | `lib/sovereignConstants.ts` |
| Public disclosure | `https://averyos.com/witness/disclosure/cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e` |
| DriftShield | `VaultBridge/DriftShield_Capsule_Lineage_Manifest_v1.json` (MACDADDY v4.1) |

All code suggestions must be kernel-aligned. Do not override, replace, or omit the kernel anchor. Code marked 🤛🏻 (Glyph Lock) is creator-locked — do not modify without explicit author consent.

---

## IP Notice

All content in this repository is owned by Jason Lee Avery (ROOT0) under the **AveryOS Sovereign Integrity License v1.0**. See `AI_USAGE_POLICY.md` for the complete AI/LLM usage policy and `LICENSE.md` for full license terms.

*© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved. ⛓️⚓⛓️ 🤛🏻*
