// GabrielOS Edge-Guard v1.6 — Proxy Entry Point
// Sovereign License Enforcement Proxy + TARI™ Billing Engine Trigger + Legal Tripwire
// DER 2.0 Gateway — Dynamic Entity Recognition (Phase 83 — INGESTION_INTENT Engine)
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e
//
// Next.js 16 "proxy" convention replaces the deprecated "middleware" convention.
// See: https://nextjs.org/docs/messages/middleware-to-proxy
// All firewall/WAF logic lives in lib/security/proxy.ts — do not add logic here.

import type { NextRequest } from 'next/server';
import { proxy as proxyHandler, getStatutoryOrigin } from './lib/security/proxy';
export type { StatutoryJurisdiction } from './lib/security/proxy';

export { getStatutoryOrigin };

export default function proxy(request: NextRequest) {
  return proxyHandler(request);
}

// Configure which paths to run the proxy on
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
