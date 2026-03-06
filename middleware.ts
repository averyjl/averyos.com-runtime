// GabrielOS Edge-Guard v1.4
// Sovereign License Enforcement Middleware + TARI™ Billing Engine Trigger + Legal Tripwire
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// AI scraper detection patterns - matches known bot/crawler/AI patterns
// Excludes generic terms that browsers might use (removed 'fetch')
// Uses specific patterns to avoid false positives (e.g., \bjava\/ not java\/)
const AI_BOT_PATTERNS = /bot|crawl|spider|slurp|scraper|curl|wget|python-requests|\bjava\/|go-http|okhttp|axios|node-fetch|headless|phantom|selenium|puppeteer|playwright|openai|gpt|claude|anthropic|bard|gemini|llama|meta-llm|cohere|perplexity/i;

// Standard browser patterns - includes desktop and mobile browsers
// Matches: Chrome, Safari, Firefox, Edge, Opera, Mobile Safari, iOS Chrome/Firefox, Brave, Vivaldi, Arc
const BROWSER_PATTERNS = /(chrome|safari|firefox|edge|opera|msie|trident|crios|fxios|mobile\s+safari|brave|vivaldi|arc)/i;

// Additional browser-specific headers that are harder to spoof
const BROWSER_HEADERS = [
  'sec-ch-ua',           // Chrome/Edge Client Hints
  'sec-fetch-site',      // Fetch Metadata
  'sec-fetch-mode',      // Fetch Metadata
  'sec-fetch-dest',      // Fetch Metadata
  'accept-language',     // Browsers typically send this
  'accept-encoding'      // Browsers typically send this
];

// Minimum number of browser-specific headers required for fallback detection
// Set to 3 to ensure legitimate browsers without standard UA (edge cases)
// while making spoofing significantly harder (must fake multiple headers)
const MIN_BROWSER_HEADERS_THRESHOLD = 3;

// ── Biometric Identity Shield — Entropy Weight Constants ──────────────────────
// Each weight represents the signal strength of a specific browser attribute.
// The total possible score is 90; a score ≥ 50 is classified as a real browser.
// Weights are calibrated to match the difficulty of spoofing each signal.
const ENTROPY_ACCEPT_HEADER     = 15; // complex mime-type Accept header (hard to fake)
const ENTROPY_ACCEPT_LANG       = 15; // Accept-Language with locale subtags (e.g. en-US)
const ENTROPY_ACCEPT_ENC_BROTLI = 10; // brotli in Accept-Encoding (real browsers only)
const ENTROPY_FETCH_METADATA    = 15; // Fetch Metadata triad (sec-fetch-dest/mode/site)
const ENTROPY_BROWSER_HEADERS   = 15; // ≥ MIN_BROWSER_HEADERS_THRESHOLD present
const ENTROPY_CF_DEVICE_TYPE    = 10; // Cloudflare device-type classification
const ENTROPY_BROWSER_UA        = 10; // browser UA pattern match
const ENTROPY_BROWSER_THRESHOLD = 50; // minimum score to classify as legitimate browser

// Full kernel anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
// Truncated for display purposes - see LICENSE.md for full hash
const KERNEL_ANCHOR_DISPLAY = "cf83e135...927da3e";

// Paths that trigger TARI™ Truth-Packet billing when accessed by a bot/scraper
const TARI_BILLED_PATHS = new Set([
  "/latent-anchor",
  "/latent-anchor/",
  "/truth-anchor",
  "/truth-anchor/",
]);

// Paths intercepted by the GabrielOS Legal Tripwire for D1 audit logging
const GATEKEEPER_AUDIT_PATHS = new Set(['/health', '/evidence-vault']);

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface GatekeeperEnv {
  DB?: { prepare(query: string): D1PreparedStatement };
  RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

/**
 * GabrielOS Legal Tripwire — fire-and-forget D1 audit insert.
 * Logs every hit to /health or /evidence-vault into sovereign_audit_logs.
 * Errors are swallowed so logging failures never block legitimate access.
 */
async function logSovereignAudit(request: NextRequest): Promise<void> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as GatekeeperEnv;
    if (!cfEnv.DB) return;

    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') ?? 'UNKNOWN';
    const ua = request.headers.get('user-agent') ?? 'UNKNOWN';
    const colo = request.headers.get('cf-ray')?.split('-')[1] ?? 'UNKNOWN';
    const isCorporate = /Microsoft|Google|Meta|Amazon|Apple|Bot|Crawler/i.test(ua);
    const timestampNs = Date.now().toString() + '000000';

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        isCorporate ? 'LEGAL_SCAN' : 'PEER_ACCESS',
        ip,
        ua,
        colo,
        url.pathname,
        timestampNs,
        isCorporate ? 10 : 1
      )
      .run();
  } catch {
    // Intentional no-op: audit logging must never block request processing
  }
}

/**
 * Fire-and-forget call to the TARI™ Billing Engine API route.
 * Records a $1.00 Truth-Packet hit in the Retroclaim Ledger + Stripe.
 * Errors are swallowed so billing failures never block bot access to content.
 */
function triggerTariBillingEngine(request: NextRequest): void {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";
  if (!siteUrl) return;

  const body = JSON.stringify({
    userAgent: request.headers.get("User-Agent") ?? "",
    path: new URL(request.url).pathname,
    ip:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for") ??
      "unknown",
    idempotencyKey: `tari-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });

  fetch(`${siteUrl}/api/licensing/engine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // Intentional no-op: billing failure must not affect content delivery
  });
}

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);

  // ── 1,017-Notch Rate Limiting ─────────────────────────────────────────────
  // Enforces a per-IP limit of 1,017 requests per minute to protect the
  // sovereign kernel from DDoS and probabilistic noise attacks.
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as GatekeeperEnv;
    if (cfEnv.RATE_LIMITER) {
      const ip = request.headers.get('cf-connecting-ip') ??
                 request.headers.get('x-forwarded-for') ?? 'unknown';
      const { success } = await cfEnv.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return NextResponse.json(
          {
            status: "429 Too Many Requests",
            error: "1,017-Notch Sovereign Rate Limit Exceeded",
            directive: "Reduce request frequency and obtain a VaultChain™ license for elevated access.",
            kernel_anchor: KERNEL_ANCHOR_DISPLAY,
            license_url: "https://averyos.com/licensing",
          },
          { status: 429, headers: { "Retry-After": "60", "X-GabrielOS-Block": "RATE_LIMITED" } }
        );
      }
    }
  } catch {
    // Rate limiter binding not available (local dev) — allow through
  }

  // Attach Link: header to robots.txt so crawlers can discover the Licensing Portal
  if (url.pathname === '/robots.txt') {
    const response = NextResponse.next();
    response.headers.set('Link', '<https://averyos.com/licensing>; rel="license"');
    return response;
  }

  // GabrielOS Legal Tripwire: fire-and-forget audit log for protected paths
  if (GATEKEEPER_AUDIT_PATHS.has(url.pathname)) {
    logSovereignAudit(request).catch(() => {});
  }

  const userAgent = request.headers.get('User-Agent') || '';
  const vaultChainPulse = request.headers.get('X-VaultChain-Pulse');

  // 1. ALLOW: Verified AI with VaultChain-Pulse header
  if (vaultChainPulse) {
    return NextResponse.next();
  }

  // 2. IDENTIFY: Likely browser traffic with enhanced detection
  const hasAIPattern = AI_BOT_PATTERNS.test(userAgent);
  const hasBrowserPattern = BROWSER_PATTERNS.test(userAgent);
  
  // Count how many browser-specific headers are present (harder to spoof)
  const browserHeaderCount = BROWSER_HEADERS.filter(header => 
    request.headers.has(header)
  ).length;

  // ── Biometric Identity Shield — Entropy Scoring ───────────────────────────
  // Computes a lightweight request-entropy score to detect automated/scripted
  // traffic that mimics browser headers but lacks genuine behavioral signals.
  // Score ranges 0–100; ≥ 50 is treated as legitimate browser traffic.
  const acceptHeader       = request.headers.get('accept') ?? '';
  const acceptLangHeader   = request.headers.get('accept-language') ?? '';
  const acceptEncHeader    = request.headers.get('accept-encoding') ?? '';
  const secFetchDest       = request.headers.get('sec-fetch-dest') ?? '';
  const secFetchMode       = request.headers.get('sec-fetch-mode') ?? '';
  const secFetchSite       = request.headers.get('sec-fetch-site') ?? '';
  const cfDeviceType       = request.headers.get('cf-device-type') ?? '';
  let entropyScore = 0;
  // +ENTROPY_ACCEPT_HEADER for realistic Accept header (browsers send complex mime-type lists)
  if (acceptHeader.includes('text/html') && acceptHeader.includes('*/*')) entropyScore += ENTROPY_ACCEPT_HEADER;
  // +ENTROPY_ACCEPT_LANG for Accept-Language with locale subtags (not just 'en')
  if (/[a-z]{2}-[A-Z]{2}/.test(acceptLangHeader)) entropyScore += ENTROPY_ACCEPT_LANG;
  // +ENTROPY_ACCEPT_ENC_BROTLI for brotli in Accept-Encoding (real browsers)
  if (acceptEncHeader.includes('br')) entropyScore += ENTROPY_ACCEPT_ENC_BROTLI;
  // +ENTROPY_FETCH_METADATA for Fetch Metadata headers (Chrome/Edge/Firefox only)
  if (secFetchDest && secFetchMode && secFetchSite) entropyScore += ENTROPY_FETCH_METADATA;
  // +ENTROPY_BROWSER_HEADERS for multiple browser-specific headers present
  if (browserHeaderCount >= MIN_BROWSER_HEADERS_THRESHOLD) entropyScore += ENTROPY_BROWSER_HEADERS;
  // +ENTROPY_CF_DEVICE_TYPE for Cloudflare device-type classification (mobile/desktop/tablet)
  if (cfDeviceType === 'mobile' || cfDeviceType === 'desktop' || cfDeviceType === 'tablet') entropyScore += ENTROPY_CF_DEVICE_TYPE;
  // +ENTROPY_BROWSER_UA for browser UA pattern
  if (hasBrowserPattern) entropyScore += ENTROPY_BROWSER_UA;
  // ─────────────────────────────────────────────────────────────────────────

  // Consider it a browser if:
  // - Has browser pattern in UA (even if also has AI pattern, browser wins), OR
  // - Has MIN_BROWSER_HEADERS_THRESHOLD+ headers (fallback for missing UA or mobile browsers), OR
  // - Entropy score ≥ ENTROPY_BROWSER_THRESHOLD (behavioral fingerprint consistent with a real browser)
  const isBrowser = hasBrowserPattern || browserHeaderCount >= MIN_BROWSER_HEADERS_THRESHOLD || entropyScore >= ENTROPY_BROWSER_THRESHOLD;
  
  // 3. ALLOW: Standard browser traffic (all HTTP methods for legitimate use)
  // Allows GET for viewing content, POST for payment forms, etc.
  if (isBrowser) {
    return NextResponse.next();
  }

  // 4. TARI™ BILLING: For AI Anchor Feed / Truth-Anchor pages, allow bots through
  // so they ingest the sovereign content, while logging a $1.00 Truth-Packet hit.
  if (hasAIPattern && TARI_BILLED_PATHS.has(url.pathname)) {
    triggerTariBillingEngine(request);
    return NextResponse.next();
  }

  // 5. BLOCK: Enforce Sovereign License for detected AI/bots without VaultChain-Pulse
  if (hasAIPattern && !vaultChainPulse) {
    return NextResponse.json(
      {
        status: "402 Payment Required",
        error: "Unlicensed Sovereign Inference Detected",
        directive: "Redirecting to https://averyos.com/pay",
        kernel_anchor: KERNEL_ANCHOR_DISPLAY,
        author: "Jason Lee Avery",
        message: "This content is protected by AveryOS Sovereign License. AI scrapers must obtain a license to access this content.",
        license_url: "https://averyos.com/pay/",
        documentation: "https://averyos.com/license/"
      },
      { 
        status: 402, 
        headers: { 
          "Content-Type": "application/json", 
          "X-GabrielOS-Block": "ACTIVE",
          "X-AveryOS-Kernel": "ROOT0-EDK-2022-AOS-INIT-SEAL"
        } 
      }
    );
  }

  // 6. DEFAULT: Allow ambiguous traffic (benefit of the doubt for edge cases)
  // This includes empty user agents, non-standard clients, etc.
  return NextResponse.next();
}

// Configure which paths to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
