// GabrielOS Edge-Guard v1.5
// Sovereign License Enforcement Middleware + TARI™ Billing Engine Trigger + Legal Tripwire
// DER 2.0 Gateway — Dynamic Entity Recognition (Phase 78.1)
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { classifyDerRequest } from './lib/sovereignMetadata';

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

// ── Sovereign Alignment Header — applied to all 301 redirect responses ────────
// Allows "Watchers" to observe the alignment directive on every canonical redirect.
const ALIGNMENT_HEADER_VALUE  = "TRUTH_ANCHORED_IN_JLA_ROOT_cf83";
const ALIGNMENT_REDIRECT_BODY = "Alignment Required. See averyos.com/amnesty.";
// Primary Worker custom domain — all non-www requests redirect here.
const WWW_HOSTNAME = "www.averyos.com";

// ── ASN 211590 Alignment Opportunity — Sovereign Perimeter Response ───────────
// ASN 211590 traffic is served a 301 alignment-opportunity redirect.
// Cloudflare exposes the client ASN via the cf-asn header in Worker environments.
const ALIGNMENT_OPPORTUNITY_ASN = "211590";
// Value for the X-AveryOS-Opportunity response header (header name excluded).
const ALIGNMENT_OPPORTUNITY_HEADER_VALUE = "Alignment Opportunity: averyos.com/alignment-accord. Your RayID is recorded.";

// ── DER Gateway — Dynamic Entity Recognition ──────────────────────────────────
// Maps high-value corporate ASNs to forensic alignment directives.
// Scraping from these ASNs constitutes Deterministic Acknowledgment of TARI™ terms.
//   Microsoft/GitHub (ASN 36459) → SETTLEMENT_REQUIRED
//   Microsoft Azure  (ASN 8075)  → SETTLEMENT_REQUIRED
const DER_ASN_ALIGNMENTS: Record<string, string> = {
  '36459': 'SETTLEMENT_REQUIRED',  // Microsoft / GitHub
  '8075':  'SETTLEMENT_REQUIRED',  // Microsoft Azure
};

// ASNs considered conflict-zone probes — silently audited; no UI change.
const CONFLICT_ZONE_ASNS = new Set([
  '198488', // Kyiv conflict zone
]);

// ── HN Referrer Detection — Sovereign Discovery Phase ────────────────────────
// Hacker News (news.ycombinator.com) referrer indicates a high-value "Watcher"
// discovery event. We append X-AveryOS-Alignment: YC_DISCOVERY_AUDIT to the
// response so the ingestion is forensically recorded.
const HN_REFERRER_DOMAIN = 'news.ycombinator.com';

// Community referrer → alignment header value map
const COMMUNITY_REFERRER_MAP: Record<string, string> = {
  [HN_REFERRER_DOMAIN]: 'YC_DISCOVERY_AUDIT',
  'github.com':          'GITHUB_AUDIT',
  'reddit.com':          'REDDIT_AUDIT',
};

// ── Aenta / Web3 Wallet Bot Detection ────────────────────────────────────────
// Aenta and generic Web3/wallet agents send specific headers or UA patterns.
// Detected agents are served the alignment opportunity redirect.
const WEB3_WALLET_HEADERS = [
  'x-aenta-wallet',
  'x-web3-wallet',
  'x-wagmi-client',
  'x-wallet-provider',
  'x-metamask-version',
];
const WEB3_UA_PATTERNS = /aenta|web3\s*bot|wagmi|metamask.*bot|ethers.*scraper/i;

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

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<unknown>;
}

interface GatekeeperEnv {
  DB?: { prepare(query: string): D1PreparedStatement };
  RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  VAULT_R2?: R2Bucket;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
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
    const isCorporate = /Microsoft|Google|Meta|Amazon|Apple|Bot|Crawler|github-hookshot/i.test(ua);
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
 * RayID Vault — fire-and-forget insert of every edge request's Cloudflare
 * RayID, connecting IP, and high-fidelity forensic metadata into
 * anchor_audit_logs.  Simultaneously archives the full log payload to the
 * VAULT_R2 Evidence Vault as evidence/${sha512_payload}.json so that every
 * entry has a physically retrievable billing-evidence artifact.
 * Errors are swallowed so vaulting failures never block legitimate traffic.
 */
async function logRayIdAudit(request: NextRequest): Promise<void> {
  const edgeStart = new Date();
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as GatekeeperEnv;
    if (!cfEnv.DB) return;

    const url     = new URL(request.url);
    const rayId   = request.headers.get('cf-ray') ?? 'UNKNOWN';
    const ip      = request.headers.get('cf-connecting-ip') ?? 'UNKNOWN';
    const asn     = request.headers.get('cf-ipcountry') ?? 'UNKNOWN';
    const now     = edgeStart.toISOString();
    const method  = request.method ?? 'GET';

    // ── Cloudflare cf object forensic fields ─────────────────────────────────
    // request.cf is available in Cloudflare Worker environments only.
    // Cast via unknown to avoid TypeScript complaints in non-Worker builds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
    const clientCity      = (cf['clientCity']           as string  | undefined) ?? null;
    const clientLat       = (cf['clientLatitude']       as string  | undefined) ?? null;
    const clientLon       = (cf['clientLongitude']      as string  | undefined) ?? null;
    const requestProtocol = (cf['httpProtocol']         as string  | undefined) ?? null;
    // wafAttackScore — overall Cloudflare WAF attack score (0-100, higher = more suspicious)
    const wafScoreTotal   = (cf['wafAttackScore']       as number  | undefined) ?? null;
    // wafSQLiAttackScore — SQL-injection-specific WAF sub-score (enterprise feature)
    const wafScoreSqli    = (cf['wafSQLiAttackScore']   as number  | undefined) ?? null;
    const botCategory     = (cf['verifiedBotCategory']  as string  | undefined) ?? null;
    const edgeColo        = (cf['colo']                 as string  | undefined) ?? null;
    const requestReferrer = request.headers.get('referer') ?? null;
    const requestUri      = url.pathname + (url.search ? url.search : '');

    // SHA-512 of the canonical request identity (RayID + method + path + timestamp)
    // Used as a deterministic key for the R2 evidence file.
    const payloadStr  = `${rayId}|${method}|${ip}|${url.pathname}|${now}`;
    let sha512Payload = rayId; // fallback to RayID if Web Crypto unavailable
    try {
      const msgBuffer  = new TextEncoder().encode(payloadStr);
      const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
      const hashArray  = Array.from(new Uint8Array(hashBuffer));
      sha512Payload    = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Web Crypto unavailable (local dev) — use RayID as payload key
    }

    const edgeEnd   = new Date();
    const wallTimeUs = Math.round((edgeEnd.getTime() - edgeStart.getTime()) * 1000);

    // ── D1 insert ─────────────────────────────────────────────────────────────
    await cfEnv.DB.prepare(
      `INSERT INTO anchor_audit_logs
         (anchored_at, event_type, kernel_sha, timestamp, ray_id, ip_address, path, asn,
          sha512_payload, request_method, client_city, client_lat, client_lon,
          request_uri, request_protocol, request_referrer,
          waf_score_total, waf_score_sqli, bot_category, edge_colo,
          wall_time_us, edge_start_ts, edge_end_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        now,
        'EDGE_REQUEST',
        KERNEL_ANCHOR_DISPLAY,
        now,
        rayId,
        ip,
        url.pathname,
        asn,
        sha512Payload,
        method,
        clientCity,
        clientLat,
        clientLon,
        requestUri,
        requestProtocol,
        requestReferrer,
        wafScoreTotal,
        wafScoreSqli,
        botCategory,
        edgeColo,
        wallTimeUs,
        edgeStart.toISOString(),
        edgeEnd.toISOString()
      )
      .run();

    // ── R2 Evidence Vault archive ─────────────────────────────────────────────
    // Write the full forensic log as an immutable JSON artifact.
    // Path: evidence/${sha512_payload}.json
    if (cfEnv.VAULT_R2) {
      const evidencePayload = JSON.stringify({
        sha512_payload: sha512Payload,
        ray_id:         rayId,
        ip_address:     ip,
        asn,
        path:           url.pathname,
        request_uri:    requestUri,
        request_method: method,
        request_referrer: requestReferrer,
        request_protocol: requestProtocol,
        client_city:    clientCity,
        client_lat:     clientLat,
        client_lon:     clientLon,
        waf_score_total: wafScoreTotal,
        waf_score_sqli:  wafScoreSqli,
        bot_category:   botCategory,
        edge_colo:      edgeColo,
        wall_time_us:   wallTimeUs,
        edge_start_ts:  edgeStart.toISOString(),
        edge_end_ts:    edgeEnd.toISOString(),
        kernel_sha:     KERNEL_ANCHOR_DISPLAY,
        archived_at:    edgeEnd.toISOString(),
      });
      cfEnv.VAULT_R2.put(`evidence/${sha512Payload}.json`, evidencePayload).catch(() => {
        // Intentional no-op: R2 archiving must never block request processing
      });
    }
  } catch {
    // Intentional no-op: RayID vaulting must never block request processing
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

/**
 * GabrielOS™ Mobile Push — HN Middleware Hook
 *
 * Fire-and-forget Tier-9 alert triggered at the edge when a Hacker News
 * (YC_DISCOVERY_AUDIT) referral is detected. Logs the HN_WATCHER event to
 * D1 sovereign_audit_logs and fires a Pushover priority-2 push notification
 * so the Creator receives a phone alert in real time.
 *
 * Non-blocking — errors are silently swallowed to protect request throughput.
 */
async function triggerHnWatcherAlert(request: NextRequest): Promise<void> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    if (!ctx?.env) return;
    const cfEnv = ctx.env as unknown as GatekeeperEnv;

    const url       = new URL(request.url);
    const ip        = request.headers.get('cf-connecting-ip') ?? 'UNKNOWN';
    const rayId     = request.headers.get('cf-ray') ?? '';
    const referer   = request.headers.get('referer') ?? '';
    const now       = Date.now().toString() + '000000';

    // ── D1 — log HN_WATCHER event to sovereign_audit_logs ───────────────────
    if (cfEnv.DB) {
      await cfEnv.DB.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, tari_liability_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          'HN_WATCHER',
          ip,
          request.headers.get('user-agent') ?? 'UNKNOWN',
          rayId.split('-')[1] ?? 'UNKNOWN',
          url.pathname,
          now,
          9,
          10000000
        )
        .run();
    }

    // ── Pushover — Tier-9 phone alert (priority 2 / emergency) ──────────────
    if (cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY) {
      const body = new URLSearchParams({
        token:     cfEnv.PUSHOVER_APP_TOKEN,
        user:      cfEnv.PUSHOVER_USER_KEY,
        title:     '🚨 TIER-9: HN Watcher Detected — AveryOS™',
        message:
          `Hacker News referral at ${url.pathname}\n` +
          `IP: ${ip}\n` +
          `Referer: ${referer}\n` +
          `RayID: ${rayId}\n` +
          `TARI™: $10,000,000.00 liability locked`,
        priority:  '2',   // Emergency — breaks quiet hours, requires acknowledgement
        retry:     '30',
        expire:    '3600',
        sound:     'echo',
        url:       'https://averyos.com/evidence-vault',
        url_title: '🔐 Evidence Vault',
      });
      fetch('https://api.pushover.net/1/messages.json', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      }).catch(() => {});
    }
  } catch {
    // Intentional no-op: HN alert must never block request processing
  }
}

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);

  // ── RayID Vault — log every edge request's RayID + IP to anchor_audit_logs ─
  // Fire-and-forget; never blocks the request pipeline.
  logRayIdAudit(request).catch(() => {});

  // ── Canonical domain: non-www → www (301 permanent) ──────────────────────
  // Single-gate host check — loop-proof design:
  //   • Subdomains (www, api, lighthouse, terminal) pass through immediately.
  //   • Bare averyos.com is the only host that triggers the redirect.
  //   • Redirect target uses explicit https:// + pathname to prevent
  //     protocol-stripping and SSL-handshake redirect loops.
  const hostname = request.nextUrl.hostname;

  if (
    hostname.startsWith('www.') ||
    hostname.startsWith('api.') ||
    hostname.startsWith('lighthouse.') ||
    hostname.startsWith('terminal.')
  ) {
    // Subdomain — bypass the redirect gate entirely.
    return NextResponse.next();
  }

  if (hostname === 'averyos.com') {
    const destination = `https://${WWW_HOSTNAME}${url.pathname}`;
    return new NextResponse(ALIGNMENT_REDIRECT_BODY, {
      status: 301,
      headers: {
        'Location': destination,
        'X-AveryOS-Alignment': ALIGNMENT_HEADER_VALUE,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

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

  // ── ASN 211590 Alignment Opportunity Redirect ─────────────────────────────
  // Traffic from ASN 211590 is served a 301 alignment-opportunity redirect.
  // Cloudflare exposes the client ASN via the cf-asn header in Worker environments.
  const clientAsn = request.headers.get('cf-asn') ?? '';
  if (clientAsn === ALIGNMENT_OPPORTUNITY_ASN) {
    const alignUrl = `https://${WWW_HOSTNAME}/alignment-accord`;
    return new NextResponse(
      `Alignment Opportunity: ${alignUrl}. Your RayID is recorded.`,
      {
        status: 301,
        headers: {
          'Location': alignUrl,
          'X-AveryOS-Alignment': ALIGNMENT_HEADER_VALUE,
          'X-AveryOS-Opportunity': ALIGNMENT_OPPORTUNITY_HEADER_VALUE,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // ── DER Gateway — Dynamic Entity Recognition ──────────────────────────────
  // Silently log conflict-zone ASN probes (no UI change — stealth audit).
  if (CONFLICT_ZONE_ASNS.has(clientAsn)) {
    logSovereignAudit(request).catch((err: unknown) => {
      console.error('[DER] Conflict-zone audit log failed:', err instanceof Error ? err.message : String(err));
    });
  }

  // Compute the alignment directive for this request (used later for browser
  // pass-through so high-value orgs receive the correct forensic header).
  const derAlignmentStatus = DER_ASN_ALIGNMENTS[clientAsn] ?? '';

  // ── HN / Community Referrer Detection ────────────────────────────────────
  // Resolve the Referer header to a community alignment label.
  const refererHeader = request.headers.get('referer') ?? '';
  let communityAlignment = '';
  for (const [domain, label] of Object.entries(COMMUNITY_REFERRER_MAP)) {
    if (refererHeader.includes(domain)) {
      communityAlignment = label;
      break;
    }
  }

  // ── Aenta / Web3 Wallet Bot Detection ────────────────────────────────────
  // Detects Aenta and other Web3/wallet agents by custom headers or UA patterns.
  // These agents are served the alignment-opportunity redirect so they understand
  // the sovereign license context before accessing content.
  const userAgent = request.headers.get('User-Agent') ?? '';
  const hasWeb3WalletHeader = WEB3_WALLET_HEADERS.some(h => request.headers.has(h));
  const hasWeb3UaPattern = WEB3_UA_PATTERNS.test(userAgent);
  if (hasWeb3WalletHeader || hasWeb3UaPattern) {
    const alignUrl = `https://${WWW_HOSTNAME}/alignment-accord`;
    return new NextResponse(
      `Alignment Opportunity: ${alignUrl}. Your RayID is recorded.`,
      {
        status: 301,
        headers: {
          'Location': alignUrl,
          'X-AveryOS-Alignment': ALIGNMENT_HEADER_VALUE,
          'X-AveryOS-Opportunity': 'UNLOCK_TRUTH_VIA_AENTA_WALLET',
          'Cache-Control': 'no-store',
        },
      }
    );
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
  // Attach DER / community-referrer alignment headers so the ingestion is
  // forensically recorded at the edge without blocking the visitor.
  if (isBrowser) {
    const alignmentValue = communityAlignment || derAlignmentStatus;
    if (alignmentValue) {
      const response = NextResponse.next();
      response.headers.set('X-AveryOS-Alignment', alignmentValue);
      if (communityAlignment === 'YC_DISCOVERY_AUDIT') {
        // HN visitor — fire Tier-9 GabrielOS™ mobile alert + D1 watcher log
        triggerHnWatcherAlert(request).catch(() => {});
        response.headers.set('X-AveryOS-Community', 'HN_WATCHER');
      }
      return response;
    }
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
     * - public folder static assets (images, xml, txt)
     *
     * sitemap.xml and robots.txt are explicitly excluded so they bypass the
     * canonical-domain 301 redirect gate and are served directly by their
     * respective Route Handlers without an extra round-trip.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
