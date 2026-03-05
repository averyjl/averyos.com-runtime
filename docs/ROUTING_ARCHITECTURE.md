# AveryOS™ Routing Architecture

⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

---

## Why Pages Were in Two Locations

Next.js supports two routing systems simultaneously:

| Router | Directory | Next.js Version | Status |
|--------|-----------|-----------------|--------|
| **Pages Router** | `pages/` | All versions (legacy) | ✅ Supported, deprecated-track |
| **App Router** | `app/` | Next.js 13+ (current) | ✅ **Recommended for all new pages** |

The AveryOS™ runtime accumulated pages in `pages/` during early development. When Next.js 13 introduced the App Router, new pages were created in `app/`. Both routers **coexist** in this project, with the App Router taking precedence for any matching route.

---

## Best Practice Going Forward

**Rule: All new pages → `app/` directory.**

The App Router provides:
- **Server Components** by default (faster, smaller JS bundles)
- **Streaming & Suspense** for progressive rendering
- **Collocated layouts** (`layout.tsx` per route segment)
- **`export const metadata`** for SEO (replaces `next/head`)
- **`force-static`** for build-time pre-rendering (replaces `getStaticProps`)
- **Route Groups** for organizing pages without affecting URLs

---

## Migration: Pages Router → App Router

### Current State (after this sprint)

All top-level pages have been migrated from `pages/` to `app/`. The original `pages/*.tsx` files were renamed to `*.tsx.migrated` (excluded from the build automatically by Next.js).

| Route | App Router Page | Type |
|-------|-----------------|------|
| `/whitepaper` | `app/whitepaper/page.tsx` | Server Component, `force-static` |
| `/about` | `app/about/page.tsx` | Server Component |
| `/contact` | `app/contact/page.tsx` | Server Component |
| `/privacy` | `app/privacy/page.tsx` | Server Component |
| `/terms` | `app/terms/page.tsx` | Server Component |
| `/creator-lock` | `app/creator-lock/page.tsx` | Server Component, `force-static` |
| `/constitution` | `app/constitution/page.tsx` | Server Component |
| `/lawcodex` | `app/lawcodex/page.tsx` | Server Component |
| `/latent-anchor` | `app/latent-anchor/page.tsx` | Server Component, `force-static` |
| `/verify` | `app/verify/page.tsx` | Client Component |
| `/diff` | `app/diff/page.tsx` | Client Component |
| `/certificate` | `app/certificate/page.tsx` | Client Component |
| `/sigtrace` | `app/sigtrace/page.tsx` | Client Component |
| `/embedbuilder` | `app/embedbuilder/page.tsx` | Client Component |
| `/discover` | `app/discover/page.tsx` | Client Component |
| `/tari-gate` | `app/tari-gate/page.tsx` | Server Component |
| `/lgic` | `app/lgic/page.tsx` | Client Component |
| `/ai-alignment` | `app/ai-alignment/page.tsx` | App Router (pre-existing) |
| `/audit-stream` | `app/audit-stream/page.tsx` | Client Component (secured) |
| `/capsules` | `app/capsules/page.tsx` | Client Component |
| `/evidence-vault` | `app/evidence-vault/page.tsx` | Server Component (secured) |
| `/health` | `app/health/page.tsx` | Client Component |
| `/ip-policy` | `app/ip-policy/page.tsx` | Server Component |
| `/ledger` | `app/ledger/page.tsx` | Client Component |
| `/license` | `app/license/page.tsx` | Server Component |
| `/licensing` | `app/licensing/page.tsx` | Server Component |
| `/partners` | `app/partners/page.tsx` | Client Component |
| `/sovereign-anchor` | `app/sovereign-anchor/page.tsx` | Client Component (secured) |
| `/the-proof` | `app/the-proof/page.tsx` | Server Component |
| `/vault-gate` | `app/vault-gate/page.tsx` | Client Component (secured) |

### Pages Still in `pages/` (dynamic / system routes)

These remain in `pages/` for technical reasons:

| Route | File | Reason |
|-------|------|--------|
| `/` (home) | `pages/index.tsx` | Home page with complex layout |
| `/_app` | `pages/_app.tsx` | Pages Router global wrapper (required) |
| `/_document` | `pages/_document.tsx` | Pages Router HTML document (required) |
| `/[capsule]` | `pages/[capsule].tsx` | Dynamic capsule renderer (complex SSG) |
| `/capsule/*` | `pages/capsule/` | Capsule sub-pages |
| `/capsuleecho/*` | `pages/capsuleecho/` | Capsule echo sub-pages |
| `/auditlog/*` | `pages/auditlog/` | Audit log sub-pages |
| `/faq/*` | `pages/faq/` | FAQ sub-pages |
| `/mesh/*` | `pages/mesh/` | Mesh sub-pages |
| `/retroclaim/*` | `pages/retroclaim/` | Retroclaim sub-pages |
| `/studio/*` | `pages/studio/` | Studio sub-pages |
| `/tai/*` | `pages/tai/` | TAI sub-pages |
| `/timeline/*` | `pages/timeline/` | Timeline sub-pages |
| `/vault/*` | `pages/vault/` | Vault sub-pages |
| `/viewer/*` | `pages/viewer/` | Viewer sub-pages |
| `/witness/*` | `pages/witness/` | Witness sub-pages |
| `pages/api/*` | `pages/api/` | Legacy API routes (gradually migrating to `app/api/v1/`) |

---

## Migration Pattern for Future Pages

### Server Component (static content)

```tsx
// app/my-page/page.tsx
import type { Metadata } from "next";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";

export const metadata: Metadata = {
  title: "My Page • AveryOS™",
  description: "Page description",
};

export default function MyPage() {
  return (
    <main className="page">
      <AnchorBanner />
      {/* content */}
      <FooterBadge />
    </main>
  );
}
```

### Server Component reading a Markdown file (replaces `getStaticProps`)

```tsx
// app/my-page/page.tsx
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { marked } from "marked";
import type { Metadata } from "next";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

// Render at build time — makes fs available, produces a static HTML asset
export const dynamic = "force-static";

export const metadata: Metadata = { title: "My Page • AveryOS™" };

export default function MyPage() {
  const raw = readFileSync(join(process.cwd(), "content", "my-page.md"), "utf8");
  const sha = createHash("sha512").update(raw, "utf8").digest("hex");
  const html = sanitizeHtml(marked(raw, { async: false }) as string);
  return (
    <main className="page">
      <p>SHA-512: {sha}</p>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
```

### Client Component (with React hooks)

```tsx
// app/my-page/layout.tsx  ← metadata lives here since page.tsx is "use client"
import type { Metadata } from "next";
export const metadata: Metadata = { title: "My Page • AveryOS™" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

```tsx
// app/my-page/page.tsx
"use client";

import { useState } from "react";
import AnchorBanner from "../../components/AnchorBanner";

export default function MyPage() {
  const [value, setValue] = useState("");
  return (
    <main className="page">
      <AnchorBanner />
      <input value={value} onChange={(e) => setValue(e.target.value)} />
    </main>
  );
}
```

### Secured Page (redirects to login if no session token)

Use `EvidenceVaultGate` or the `isAuthenticated === null` pattern:

```tsx
// app/my-secure-page/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MySecurePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("sovereign_handshake");
    if (!token) {
      setIsAuthenticated(false);
      router.replace("/evidence-vault/login"); // or the relevant login page
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Return null while checking — prevents ANY content from flashing
  if (isAuthenticated !== true) return null;

  return <main className="page">{/* secure content */}</main>;
}
```

---

## Secure Pages: Preventing Content Flash

The golden rule: **`if (isAuthenticated !== true) return null`**

This ensures:
1. Server render → empty HTML (no secure content in initial HTML)
2. Client hydrates → `useEffect` reads `sessionStorage`
3. If no token: redirect to login (instantaneous)
4. If token valid: render secure content

**Do NOT** initialize auth state to `true` or `false` — always use `null` as the initial value to distinguish "checking" from "denied".

Navigation links to secured pages should link directly to the secured page (not the login page). The gate on the page itself handles the redirect.

---

## API Routes

| Location | Pattern | When to use |
|----------|---------|-------------|
| `app/api/v1/*/route.ts` | App Router API Routes | ✅ All new API routes |
| `pages/api/*.ts` | Pages Router API | Legacy only; do not add new ones |

App Router API routes use `getCloudflareContext()` for D1/KV/R2 access and `aosErrorResponse()` / `d1ErrorResponse()` from `lib/sovereignError.ts` for all error responses.

---

*⛓️⚓⛓️ © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.*
