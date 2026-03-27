// GabrielOS Edge-Guard v1.6 — Proxy Bridge Entry Point (GATE 126.2.3)
// Sovereign License Enforcement Middleware + TARI™ Billing Engine Trigger + Legal Tripwire
// DER 2.0 Gateway — Dynamic Entity Recognition (Phase 83 — INGESTION_INTENT Engine)
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e
//
// GATE 126.2.3: All firewall/WAF logic has been extracted to lib/security/proxy.ts
// to achieve naming alignment with 'Proxy' without breaking Next.js runtime.
// This file is a thin re-export bridge — do not add logic here.

export { proxy as default, getStatutoryOrigin } from './lib/security/proxy';
export type { StatutoryJurisdiction } from './lib/security/proxy';

// Configure which paths to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder static assets (images, xml, txt)
     *
     * sitemap.xml and robots.txt are explicitly excluded so they bypass the
     * canonical-domain 301 redirect gate and are served directly by their
     * respective Route Handlers without an extra round-trip.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
