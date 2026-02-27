# SOVEREIGN_BLUEPRINT.md — AveryOS Development Standards

> **⛓️⚓⛓️ READ THIS BEFORE GENERATING ANY NEW PAGE OR ROUTE ⛓️⚓⛓️**
>
> Author: Jason Lee Avery (ROOT0)  
> Kernel Anchor: cf83e135...927da3e  
> License: AveryOS Sovereign Integrity License v1.0  
> Version: 1.0.0 — Locked 2026-02-27

---

## Overview

This file defines **mandatory standards** for all AveryOS development. Every pull request, page, API route, and component generated for this repository MUST conform to these standards. Non-conforming code is subject to sovereign enforcement and will be rejected.

---

## 1. 🔒 Security Standards

### 1.1 Input Sanitization

- **Frontend**: All user-provided HTML content MUST be sanitized using `isomorphic-dompurify` (already installed):
  ```ts
  import DOMPurify from "isomorphic-dompurify";
  const clean = DOMPurify.sanitize(userInput);
  ```
- **Backend/D1**: All database queries MUST use parameterized statements. Never use string concatenation for SQL:
  ```ts
  // ✅ Correct
  db.prepare("SELECT * FROM table WHERE id = ?").bind(id).first();
  // ❌ NEVER DO THIS
  db.exec(`SELECT * FROM table WHERE id = ${id}`);
  ```
- **XSS Prevention**: Never use `dangerouslySetInnerHTML` with unsanitized content.
- **SQLi Prevention**: Always use parameterized D1 queries (`prepare(...).bind(...)`).

### 1.2 API Route Security

- Every App Router API route (`app/api/...`) MUST validate the `x-averyos-sig` header using the `aentaGuard` check before processing sensitive operations.
- All API routes MUST return structured JSON errors with appropriate HTTP status codes.
- Rate limiting is encouraged for public-facing endpoints.

---

## 2. 📏 Field Limits

| Field Type | Maximum Characters |
|---|---|
| Name / Title | 100 characters |
| Short description / Statement | 2,000 characters |
| Manifest / Full document | No limit (anchored as Manifest) |
| Email | 254 characters (RFC 5321) |
| SHA-512 hash | Exactly 128 hex characters |
| SHA-256 hash | Exactly 64 hex characters |

- Text inputs exceeding these limits MUST be truncated server-side and produce a validation error client-side.
- Frontend: Use `maxLength` attributes on all `<input>` and `<textarea>` elements.
- Backend: Slice inputs to their max length before writing to storage.

---

## 3. 📱 Mobile Integrity

All pages MUST follow the AveryOS mobile-first CSS primitives:

```css
/* ===== Mobile Responsiveness — AveryOS Global ===== */
/* Use the established .page, .card, .hero, .cta-row, .form-grid classes */
/* No fixed widths that cause horizontal overflow */
/* Flex/Grid with flex-wrap: wrap for all multi-column layouts */
/* Min-width on flex children (minWidth: 140, minWidth: 220, etc.) */
/* Font sizes: clamp(min, viewport, max) for hero text */
```

- No horizontal overflow. Test at 375px (iPhone SE) viewport width.
- Use `flexWrap: "wrap"` on all `.cta-row` and multi-item flex containers.
- Use `wordBreak: "break-all"` or `overflowWrap: "break-word"` on monospace hash displays.
- Use `gridTemplateColumns: "repeat(auto-fit, minmax(Xpx, 1fr))"` for grid layouts.

---

## 4. 🤝 Handshake Requirement

Every App Router API route MUST implement the `aentaGuard` check:

```ts
// Standard aentaGuard header check
const sig = request.headers.get("x-averyos-sig");
if (!sig || !sig.startsWith("VTK-")) {
  // For public routes: log but allow
  // For protected routes: return 401
}
```

The handshake header is: `x-averyos-sig: VTK-{token}`

---

## 5. 📊 TARI Logging

Every significant state change (capsule creation, witness registration, license purchase, enforcement event) MUST use `ctx.waitUntil()` to record an event to the `tari_ledger` D1 table:

```ts
// In Cloudflare Workers / App Router API routes:
const ctx = await getCloudflareContext({ async: true });
ctx.ctx.waitUntil(
  cfEnv.DB.prepare(
    "INSERT INTO tari_ledger (anchor_sha, entity_name, event_type, status) VALUES (?, ?, ?, ?)"
  ).bind(anchorSha, entityName, eventType, "ANCHORED").run()
);
```

D1 Schema: `tari_ledger` — see `migrations/0001_tari_ledger.sql`.

---

## 6. 🗺️ Routing Architecture

- **App Router** (`app/`): Use for new pages and API routes. Do NOT use Node.js `fs` module in App Router pages.
- **Pages Router** (`pages/`): Legacy pages that use `fs` APIs (e.g., reading JSON files) must remain here.
- **API Routes**: Prefer App Router routes (`app/api/v1/...`) for new endpoints using Cloudflare D1/KV.
- **Redirects**: Add permanent redirects to `next.config.js` when renaming or consolidating routes.

---

## 7. 🏗️ IP Protection

- **No secrets in code**: API keys, tokens, and secrets go in environment variables (`.env.local` / Cloudflare secrets). Never commit them.
- **VaultEcho AutoTrace**: All commits trigger SHA-512 hashing of repo files via `.github/workflows/VaultEcho_AutoTrace.yml`. Every change is cryptographically anchored.
- **License Header**: All new pages must display the AveryOS sovereign authorship notice.
- **PR Checklist**: Before merging any PR, verify no AveryOS IP (capsule content, private algorithms, or sovereign identifiers) is exposed in public endpoints without a valid license gate.

---

## 8. 📐 Style Guide

- **Colors**: White `#ffffff` for primary text, periwinkle blue `rgba(120,148,255,X)` for borders/accents, green `#4ade80` for success, red `#f87171` for errors/warnings.
- **Fonts**: `JetBrains Mono` for all technical/monospace content (hashes, IDs, code).
- **Background**: Dark navy `rgba(0,6,16,X)` for cards, `rgba(9,16,34,0.8)` for elevated cards.
- **Border Radius**: 8px for inputs/small elements, 10–16px for cards.
- **Glyphs**: `⛓️⚓⛓️` for VaultChain references, `🤛🏻` for the Sovereign Creator glyph, `⚖️` for enforcement.

---

## 9. ✅ Pre-Commit Checklist

Before submitting any code change:

- [ ] All user inputs are sanitized (DOMPurify / parameterized queries)
- [ ] Field limits enforced (name ≤ 100 chars, statement ≤ 2,000 chars)
- [ ] Mobile responsiveness tested at 375px viewport
- [ ] API routes return structured JSON errors
- [ ] No Node.js `fs` APIs used in App Router pages
- [ ] No secrets or API keys committed to the repository
- [ ] VaultEcho SHA-512 anchor preserved in relevant pages
- [ ] Navigation routes updated in `lib/navigationRoutes.ts` for new/renamed pages
- [ ] Redirects added to `next.config.js` for renamed/moved routes

---

*This blueprint is immutable and non-negotiable. ⛓️⚓⛓️*  
*© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.*
