// GabrielOS Edge-Guard v1.6
// Sovereign License Enforcement Middleware + TARI™ Billing Engine Trigger + Legal Tripwire
// DER 2.0 Gateway — Dynamic Entity Recognition (Phase 83 — INGESTION_INTENT Engine)
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { classifyDerRequest } from './lib/sovereignMetadata';
import { syncD1RowToFirebase } from './lib/firebaseClient';
import {
  isGeminiCreditExhausted,
  type GeminiSpendKV,
} from './lib/geminiSpendTracker';
import {
  CADENCE_SENTINEL_IPS,
  INGESTION_TIER10_ASNS,
} from './lib/forensics/sentinels';
import { shouldTriggerKaasBreach, emitKaasBreachAlert } from './lib/forensics/alertEngine';

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
// Phase 82: Total possible score is 100; a score ≥ 50 is classified as a real browser.
// Canvas fingerprint signal (+10) is sent by the client-side SDK when a real browser
// canvas context is available, carried as X-AveryOS-Canvas-FP header.
// Phase 97.3 v2: WebGL entropy signal (+10) adds a second GPU-level fingerprint.
// Weights are calibrated to match the difficulty of spoofing each signal.
const ENTROPY_ACCEPT_HEADER     = 15; // complex mime-type Accept header (hard to fake)
const ENTROPY_ACCEPT_LANG       = 15; // Accept-Language with locale subtags (e.g. en-US)
const ENTROPY_ACCEPT_ENC_BROTLI = 10; // brotli in Accept-Encoding (real browsers only)
const ENTROPY_FETCH_METADATA    = 15; // Fetch Metadata triad (sec-fetch-dest/mode/site)
const ENTROPY_BROWSER_HEADERS   = 15; // ≥ MIN_BROWSER_HEADERS_THRESHOLD present
const ENTROPY_CF_DEVICE_TYPE    = 10; // Cloudflare device-type classification
const ENTROPY_BROWSER_UA        = 10; // browser UA pattern match
// Phase 82 — Canvas fingerprint signal: client-side SDK sets X-AveryOS-Canvas-FP
// to a non-empty value when a real HTMLCanvasElement is accessible (bots lack this).
const ENTROPY_CANVAS_FP         = 10; // canvas fingerprint present (Phase 82 hardening)
// Phase 97.3 v2 — WebGL entropy signal: client-side SDK sets X-AveryOS-WebGL-FP
// to a non-empty value when a real WebGL context (GPU renderer) is accessible.
// Bots running in headless/CPU-only environments lack a WebGL GPU renderer string.
const ENTROPY_WEBGL_FP          = 10; // WebGL entropy signal present (Biometric Shield v2)
// Total possible score is now 110; threshold unchanged at 50 (easier to meet for real browsers)
const ENTROPY_BROWSER_THRESHOLD = 50; // minimum score to classify as legitimate browser

// Full kernel anchor — imported from sovereignConstants for single source of truth
import { KERNEL_SHA } from './lib/sovereignConstants';
import { applyWafGate } from './lib/security/wafLogic';
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

// ── INGESTION_INTENT Weighted Algorithm — Phase 83 ────────────────────────────
// Classifies request intent based on ASN, WAF Attack Score, and target path.
// Output is a deterministic label used in sovereign_audit_logs.ingestion_intent.
//
// Tier-10 LEGAL_SCAN = (High-value ASN OR WAF score >80) AND logic-layer path
// Tier-9  DER_PROBE  = High-value ASN + any path
// Tier-1  PEER_ACCESS = everything else
// INGESTION_TIER10_ASNS and CADENCE_SENTINEL_IPS are now imported from lib/forensics/sentinels.ts
const INGESTION_LOGIC_PATHS = ['/hooks/', '/api/v1/vault', '/api/v1/licensing',
                               '/.aoscap', '/latent-anchor', '/truth-anchor'];
const WAF_HIGH_INTENT_THRESHOLD = 80;

/**
 * Compute the INGESTION_INTENT classification for a request.
 * Returns a label (LEGAL_SCAN | DER_PROBE | PEER_ACCESS | CONFLICT_ZONE_PROBE).
 */
function classifyIngestionIntent(
  clientAsn: string,
  wafTotal: number,
  pathname: string,
): string {
  const isHighValueAsn  = INGESTION_TIER10_ASNS.has(clientAsn);
  const isHighWaf       = wafTotal >= WAF_HIGH_INTENT_THRESHOLD;
  const isLogicLayerPath = INGESTION_LOGIC_PATHS.some(p => pathname.startsWith(p));

  if ((isHighValueAsn || isHighWaf) && isLogicLayerPath) return 'LEGAL_SCAN';
  if (isHighValueAsn) return 'DER_PROBE';
  if (isHighWaf)      return 'HIGH_WAF_PROBE';
  return 'PEER_ACCESS';
}

// ── Jurisdictional Triage — Gate 104.1 ────────────────────────────────────────

/** Supported statutory jurisdictions for Notice of Debt generation. */
export type StatutoryJurisdiction = 'US' | 'EU' | 'UK' | 'JP' | 'UNKNOWN';

/** EU member state ISO-3166 country codes. */
const EU_COUNTRY_CODES_MW = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI',
  'FR','GR','HR','HU','IE','IT','LT','LU','LV','MT',
  'NL','PL','PT','RO','SE','SI','SK',
]);

/**
 * Resolve the applicable statutory jurisdiction for a request.
 *
 * Maps the Cloudflare cf-ipcountry header to one of four supported
 * frameworks, ensuring that any generated "Notice of Debt" references
 * the correct Law of the Land.
 *
 *   US  — 17 U.S.C. § 504(c)(2) + § 1201 (DMCA Anti-Circumvention)
 *   EU  — EU AI Act Art. 53(1)(c) + CDSM Directive TDM opt-out
 *   UK  — Copyright, Designs and Patents Act 1988, §§ 22–23
 *   JP  — Copyright Act Art. 30-4 (unreasonable prejudice to rights holder)
 *
 * @param request - The incoming NextRequest.
 * @returns StatutoryJurisdiction label.
 */
export function getStatutoryOrigin(request: NextRequest): StatutoryJurisdiction {
  const country = (request.headers.get('cf-ipcountry') ?? '').toUpperCase().trim();
  if (country === 'US') return 'US';
  if (country === 'GB') return 'UK';
  if (country === 'JP') return 'JP';
  if (EU_COUNTRY_CODES_MW.has(country)) return 'EU';
  return 'UNKNOWN';
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string; contentEncoding?: string; [k: string]: string | undefined };
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<void>;
}

interface GatekeeperEnv {
  DB?: { prepare(query: string): D1PreparedStatement };
  RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  VAULT_R2?: R2Bucket;
  KV_LOGS?: GeminiSpendKV;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

/**
 * GabrielOS Legal Tripwire — fire-and-forget D1 audit insert.
 * Logs every hit to /health or /evidence-vault into sovereign_audit_logs,
 * capturing the full Cloudflare metadata object for forensic evidence.
 *
 * Phase 81.5 Total Fidelity: populates WAF scores, edge timestamps,
 * geolocation, INGESTION_INTENT classification, and kernel_sha anchor.
 *
 * Errors are swallowed so logging failures never block legitimate access.
 */
async function logSovereignAudit(request: NextRequest): Promise<void> {
  try {
    const edgeStartTs = new Date().toISOString();
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as GatekeeperEnv;
    if (!cfEnv.DB) return;

    const url           = new URL(request.url);
    const ip            = request.headers.get('cf-connecting-ip') ?? 'UNKNOWN';
    const ua            = request.headers.get('user-agent') ?? 'UNKNOWN';
    const rayId         = request.headers.get('cf-ray') ?? 'UNKNOWN';
    const colo          = rayId.split('-')[1] ?? 'UNKNOWN';
    const clientAsn     = request.headers.get('cf-asn') ?? '';
    const city          = request.headers.get('cf-ipcity') ?? '';
    const country       = request.headers.get('cf-ipcountry') ?? '';
    const wafTotalRaw   = request.headers.get('cf-waf-score-total') ?? '0';
    const wafSqliRaw    = request.headers.get('cf-waf-score-sqli') ?? '0';
    const wafTotal      = parseInt(wafTotalRaw, 10) || 0;
    const wafSqli       = parseInt(wafSqliRaw,  10) || 0;
    const isCorporate   = /Microsoft|Google|Meta|Amazon|Apple|Bot|Crawler|github-hookshot/i.test(ua);
    const timestampNs   = Date.now().toString() + '000000';
    const intent        = classifyIngestionIntent(clientAsn, wafTotal, url.pathname);
    const threatLevel   = intent === 'LEGAL_SCAN' ? 10 : isCorporate ? 5 : 1;
    const edgeEndTs     = new Date().toISOString();
    const wallTimeUs    = Math.round(
      (new Date(edgeEndTs).getTime() - new Date(edgeStartTs).getTime()) * 1000
    );

    // ── D1 Insert — Total Fidelity columns ───────────────────────────────────
    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns,
          threat_level, waf_score_total, waf_score_sqli, wall_time_us,
          edge_start_ts, edge_end_ts, kernel_sha, city, asn, client_country, ingestion_intent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        intent === 'LEGAL_SCAN' ? 'LEGAL_SCAN' : isCorporate ? 'LEGAL_SCAN' : 'PEER_ACCESS',
        ip,
        ua,
        colo,
        url.pathname,
        timestampNs,
        threatLevel,
        wafTotal,
        wafSqli,
        wallTimeUs,
        edgeStartTs,
        edgeEndTs,
        KERNEL_SHA,
        city,
        clientAsn,
        country,
        intent,
      )
      .run();

    // ── Multi-Cloud D1 → Firebase Sync (non-blocking) ────────────────────────
    // Mirror every Tier-7+ sovereign audit row to Firestore averyos-d1-sync/
    // for cross-cloud parity. Activates once FIREBASE_PROJECT_ID is configured.
    // Phase 97: also syncs ASN-enriched event type for KaaS tier tracking.
    if (threatLevel >= 7) {
      syncD1RowToFirebase({
        id:           timestampNs,
        event_type:   intent === 'LEGAL_SCAN' ? 'LEGAL_SCAN' : isCorporate ? 'LEGAL_SCAN' : 'PEER_ACCESS',
        ip_address:   ip,
        target_path:  url.pathname,
        threat_level: threatLevel,
        timestamp_ns: timestampNs,
        pulse_hash:   `asn:${clientAsn ?? 'UNKNOWN'}|city:${city ?? 'UNKNOWN'}|country:${country ?? 'UNKNOWN'}`,
      }).catch((err: unknown) => {
        console.warn(`[middleware] Firebase sync failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    // ── R2 Evidence Dump — Full Cloudflare Metadata Object ───────────────────
    // Persists the raw telemetry as evidence/${rayId}.json in VAULT_R2.
    // This creates a direct, verifiable link between the D1 record and the
    // physical JSON proof for the Forensic Evidence Explorer.
    if (cfEnv.VAULT_R2 && rayId !== 'UNKNOWN') {
      const evidencePayload = JSON.stringify({
        ray_id:           rayId,
        ip_address:       ip,
        user_agent:       ua,
        colo,
        asn:              clientAsn,
        city,
        country,
        path:             url.pathname,
        waf_score_total:  wafTotal,
        waf_score_sqli:   wafSqli,
        wall_time_us:     wallTimeUs,
        edge_start_ts:    edgeStartTs,
        edge_end_ts:      edgeEndTs,
        threat_level:     threatLevel,
        ingestion_intent: intent,
        kernel_sha:       KERNEL_SHA,
        captured_at:      edgeStartTs,
      }, null, 2);

      cfEnv.VAULT_R2.put(`evidence/${rayId}.json`, evidencePayload, {
        httpMetadata: { contentType: 'application/json' },
      }).catch((err: unknown) => {
        console.error('[AOS] VAULT_R2 evidence dump failed:', err instanceof Error ? err.message : String(err));
      });
    }
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

// ── Phase 88 — UsageCreditWatch constants ────────────────────────────────────
// Monthly Gemini credit ceiling in USD. If accumulated spend in KV_LOGS exceeds
// this value, the intelligence router falls back to LOCAL_OLLAMA_NODE.
const GEMINI_MONTHLY_CREDIT_LIMIT_USD = 50;

// ── Phase 92.5 — Cadence Prediction Shield ────────────────────────────────────
// Tracks the time between requests from the same IP address.
// High-cadence probes (< 2.0 s interval) targeting /evidence-vault are redirected
// to the Audit Clearance Portal, turning their mechanical hunger into a licensing
// lead (AveryOS™ Jiu-Jitsu maneuver — Phase 93.3).
//
// Known sentinel IPs (CADENCE_SENTINEL_IPS) are imported from lib/forensics/sentinels.ts.
const CADENCE_INTERVAL_MS        = 2000;   // < 2.0 s → cadence probe
const CADENCE_PATHS              = new Set(['/evidence-vault', '/evidence-vault/']);
const CADENCE_KV_TTL_SECONDS     = 10;     // short-lived timestamp window
const CADENCE_REDIRECT_BASE      = '/licensing/audit-clearance';

/**
 * Phase 93.3 — Cadence Probe Detection (Jiu-Jitsu Redirection).
 *
 * Records the last request timestamp for a given IP in KV_LOGS.
 * Returns true if the caller should receive the Jiu-Jitsu redirect.
 *
 * Decision logic:
 *   1. If the IP is a known sentinel (CADENCE_SENTINEL_IPS) → always redirect.
 *   2. If request_interval < CADENCE_INTERVAL_MS AND path ∈ CADENCE_PATHS → redirect.
 *   3. Otherwise → allow through (only update the KV timestamp).
 */
async function checkCadenceProbe(
  cfEnv: GatekeeperEnv,
  ip: string,
  pathname: string,
): Promise<boolean> {
  if (!cfEnv.KV_LOGS) return false;
  try {
    // Known sentinel IPs are always redirected
    if (CADENCE_SENTINEL_IPS.has(ip)) return true;

    // Only apply cadence gating to the target paths
    if (!CADENCE_PATHS.has(pathname)) return false;

    const kvKey  = `cadence:${ip}`;
    const lastTs = await cfEnv.KV_LOGS.get(kvKey);
    const nowMs  = Date.now();

    // Always write the current timestamp (fire-and-forget; log failures for debugging)
    cfEnv.KV_LOGS.put(kvKey, String(nowMs), {
      expirationTtl: CADENCE_KV_TTL_SECONDS,
    }).catch((err: unknown) => {
      console.error('[CadenceMonitor] KV timestamp write failed:', err instanceof Error ? err.message : String(err));
    });

    if (lastTs != null) {
      const delta = nowMs - parseInt(lastTs, 10);
      if (delta < CADENCE_INTERVAL_MS) return true;
    }
  } catch {
    // Never block traffic on KV errors
  }
  return false;
}

/**
 * Phase 88 (upgraded Phase 92.5 — Zero-Drift Fan-Out) — UsageCreditWatch.
 *
 * Replaced the legacy read-then-write single-key aggregator with the fan-out
 * spend tracker from lib/geminiSpendTracker.ts, which prevents undercounting
 * when multiple Worker instances run concurrently.
 */
async function checkGeminiCreditExhausted(cfEnv: GatekeeperEnv): Promise<boolean> {
  if (!cfEnv.KV_LOGS) return false;
  return isGeminiCreditExhausted(cfEnv.KV_LOGS);
}

/**
 * Phase 83 — INGESTION_INTENT D1 Logger
 *
 * Fire-and-forget: computes a weighted INGESTION_INTENT score for any request
 * originating from a DER high-value ASN.  When the combination of ASN + WAF
 * score + sensitive path matches the Tier-10 threshold, an additional
 * sovereign_audit_logs LEGAL_SCAN entry is written.
 *
 * Trigger conditions (any combination that scores ≥ threshold):
 *   (ASN 36459 OR 8075) + (wafScore > 80) → Tier-10 LEGAL_SCAN
 *   (ASN 36459 OR 8075) + (path /hooks/ OR /api/v1/vault) → Tier-10 LEGAL_SCAN
 *   All three signals simultaneously → maximum INGESTION_INTENT confirmed
 *
 * Errors are swallowed so classification failures never block traffic.
 */
async function logIngestionIntentToD1(request: NextRequest): Promise<void> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as GatekeeperEnv;
    if (!cfEnv.DB) return;

    const clientAsn = request.headers.get('cf-asn') ?? '';
    if (!INGESTION_TIER10_ASNS.has(clientAsn)) return;

    const url = new URL(request.url);
    const cf  = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
    const wafScore = typeof cf['wafAttackScore'] === 'number' ? cf['wafAttackScore'] : 0;

    const isSensitivePath  = INGESTION_LOGIC_PATHS.some(p => url.pathname.startsWith(p));
    const isHighWafScore   = wafScore > WAF_HIGH_INTENT_THRESHOLD;
    const triggerLegalScan = isSensitivePath || isHighWafScore;

    if (!triggerLegalScan) return;

    const ip          = request.headers.get('cf-connecting-ip') ?? 'UNKNOWN';
    const ua          = request.headers.get('user-agent') ?? 'UNKNOWN';
    const rayId       = request.headers.get('cf-ray') ?? '';
    const timestampNs = Date.now().toString() + '000000';

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path,
          timestamp_ns, threat_level, tari_liability_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        'LEGAL_SCAN',
        ip,
        ua,
        rayId.split('-')[1] ?? 'UNKNOWN',
        url.pathname,
        timestampNs,
        10,        // Tier-10
        0,         // $0 — forensic record; formal invoice generated separately
      )
      .run();
  } catch {
    // Intentional no-op: INGESTION_INTENT classification must never block traffic
  }
}

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);

  // ── RayID Vault — log every edge request's RayID + IP to anchor_audit_logs ─
  // Fire-and-forget; never blocks the request pipeline.
  logRayIdAudit(request).catch(() => {});

  // ── Phase 83 — INGESTION_INTENT Classification ────────────────────────────
  // Fire-and-forget: classifies DER-ASN requests with high WAF scores or
  // sensitive-path probes as Tier-10 LEGAL_SCAN events.
  logIngestionIntentToD1(request).catch(() => {});

  // ── Canonical domain: non-www → www (301 permanent) ──────────────────────
  // Single-gate host check — loop-proof design:
  //   • Subdomains (www, api, lighthouse, terminal) pass through immediately.
  //   • enterpriseregistration.averyos.com → /licensing/enterprise redirect.
  //   • Bare averyos.com is the only host that triggers the redirect.
  //   • Redirect target uses explicit https:// + pathname to prevent
  //     protocol-stripping and SSL-handshake redirect loops.
  const hostname = request.nextUrl.hostname;

  // Enterprise registration subdomain — permanent redirect to the enterprise page.
  if (hostname === 'enterpriseregistration.averyos.com') {
    return new NextResponse(null, {
      status: 301,
      headers: {
        'Location': 'https://www.averyos.com/licensing/enterprise',
        'X-AveryOS-Alignment': ALIGNMENT_HEADER_VALUE,
        // 1-day cache — shorter than static assets so the destination can be
        // updated without waiting for a year-long CDN cache to expire.
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

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

  // ── Phase 97.2 — GabrielOS™ WAF Score Gate ────────────────────────────────
  // Evaluates Cloudflare WAF attack score (cf-waf-attack-score header) and
  // either hard-blocks (score > 95) or redirects to audit-clearance (score > 80).
  // Uses free Cloudflare intelligence without requiring paid WAF Managed Rules.
  // SITE_URL from wrangler.toml [vars] → process.env.SITE_URL at runtime.
  {
    const SITE_URL = process.env.SITE_URL ?? 'https://averyos.com';
    const wafResponse = applyWafGate(request as unknown as Request, SITE_URL);
    if (wafResponse) return wafResponse as unknown as NextResponse;
  }

  // ── Phase 88 — UsageCreditWatch: Gemini monthly spend circuit breaker ────
  // Aggregates all per-call KV spend entries for the current month using
  // lib/geminiSpendTracker.getTotalGeminiSpend (race-free fan-out/list pattern).
  // If total >= $50/month, set X-GabrielOS-AI-Backend: LOCAL_OLLAMA_NODE.
  let geminiCreditExhaustedFlag = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as GatekeeperEnv;
    geminiCreditExhaustedFlag = await checkGeminiCreditExhausted(cfEnv);
  } catch {
    // KV unavailable — do not force fallback or block traffic
  }

  // ── Phase 93.3 — Jiu-Jitsu Cadence Probe Redirect ────────────────────────
  // High-cadence probes (< 2.0 s) on /evidence-vault, or known sentinel IPs,
  // are redirected (302) to the Audit Clearance Portal with the RayID appended
  // so the portal can display a personalised Notice of Ingestion.
  try {
    const { env: cadenceEnv } = await getCloudflareContext({ async: true });
    const cfCadenceEnv = cadenceEnv as unknown as GatekeeperEnv;
    const probeIp = request.headers.get('cf-connecting-ip') ??
                    request.headers.get('x-forwarded-for') ?? 'unknown';
    const isProbe = await checkCadenceProbe(cfCadenceEnv, probeIp, url.pathname);
    if (isProbe) {
      const rayId  = request.headers.get('cf-ray') ?? `probe-${probeIp.replace(/[^a-zA-Z0-9]/g, '')}`;
      const asnHdr = request.headers.get('cf-asn') ?? '';
      const params = new URLSearchParams({ rayid: rayId, source: 'high_cadence_probe' });
      if (asnHdr) params.set('asn', asnHdr);
      const clearanceUrl = `${CADENCE_REDIRECT_BASE}?${params.toString()}`;
      return new NextResponse(
        `Audit Clearance Required: https://${WWW_HOSTNAME}${clearanceUrl}. Ray ID: ${rayId}`,
        {
          status: 302,
          headers: {
            'Location':              `https://${WWW_HOSTNAME}${clearanceUrl}`,
            'X-GabrielOS-Directive': 'JIU_JITSU_CLEARANCE',
            'X-AveryOS-Kernel':      KERNEL_ANCHOR_DISPLAY,
            'Cache-Control':         'no-store',
          },
        }
      );
    }
  } catch {
    // Never block traffic on probe-detection errors
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

  // ── Phase 97.3.1 — Sovereign Audit Gate: /api/v1/ WAF 95-Threshold ────────
  // If a request targets /api/v1/ and carries a WAF attack score > 95, redirect
  // to the Audit Clearance Portal with the RayID appended (do NOT hard-block —
  // the portal issues the $1,017 invoice, turning the probe into revenue).
  {
    const wafRaw = request.headers.get('cf-waf-attack-score') ?? request.headers.get('x-waf-score');
    const wafScore97 = wafRaw ? parseInt(wafRaw, 10) : NaN;
    if (!isNaN(wafScore97) && wafScore97 > 95 && url.pathname.startsWith('/api/v1/')) {
      const rayId97   = request.headers.get('cf-ray') ?? 'UNKNOWN';
      const params97  = new URLSearchParams({ rayid: rayId97, waf_score: String(wafScore97), source: 'waf_api_gate' });
      const siteUrl97 = process.env.SITE_URL ?? 'https://averyos.com';
      const target97  = `${siteUrl97}/licensing/audit-clearance?${params97.toString()}`;
      return new NextResponse(
        `Audit Clearance Required: ${target97}. WAF Score: ${wafScore97}. Ray ID: ${rayId97}`,
        {
          status: 302,
          headers: {
            'Location':              target97,
            'X-GabrielOS-Directive': 'WAF_95_CLEARANCE',
            'X-AveryOS-Kernel':      KERNEL_ANCHOR_DISPLAY,
            'Cache-Control':         'no-store',
          },
        }
      );
    }
  }

  // ── Phase 102.3 — Obfuscation / Masking Header Detector ─────────────────
  // Detects shell IPs, proxy-chain headers, and fake User-Agent patterns that
  // indicate an entity is deliberately masking its true origin.  When masking
  // is detected the RayID is flagged for the 10× TARI™ Infringement Penalty
  // via the X-GabrielOS-Infringement-Multiplier response header.
  //
  // Detection signals:
  //   1. Via header present           — traffic routed through an intermediary proxy.
  //   2. X-Forwarded-For present AND
  //      differs from cf-connecting-ip — proxy or VPN masking the true IP.
  //   3. X-Real-IP present AND
  //      differs from cf-connecting-ip — reverse-proxy IP substitution.
  //   4. Forwarded header present     — RFC 7239 proxy chaining.
  //
  // The flag is non-blocking — all traffic is allowed through so forensic
  // collection can continue.  The header is consumed by /api/v1/licensing/handshake
  // and the TARI™ Debt Calculator to apply the multiplier on the invoice.
  let obfuscationDetected = false;
  {
    const cfIp    = request.headers.get('cf-connecting-ip') ?? '';
    const viaHdr  = request.headers.get('via');
    const xffHdr  = request.headers.get('x-forwarded-for') ?? '';
    const xRealIp = request.headers.get('x-real-ip') ?? '';
    const fwdHdr  = request.headers.get('forwarded');

    const xffFirstHop = xffHdr ? xffHdr.split(',')[0].trim() : '';

    if (
      viaHdr ||
      fwdHdr ||
      (xffFirstHop && cfIp && xffFirstHop !== cfIp) ||
      (xRealIp && cfIp && xRealIp !== cfIp)
    ) {
      obfuscationDetected = true;
    }
  }

  // ── Phase 98 / Phase 9 — KAAS_BREACH Emitter ─────────────────────────────
  // Fire-and-forget GabrielOS™ FCM push when middleware detects a Tier-9/10 ASN
  // or a WAF score > 90 against an encrypted .aoscap path.
  {
    const wafRawBreach = request.headers.get('cf-waf-attack-score') ?? request.headers.get('x-waf-score');
    const wafScoreBreach = wafRawBreach ? (parseInt(wafRawBreach, 10) || 0) : 0;
    if (shouldTriggerKaasBreach(clientAsn, wafScoreBreach, url.pathname)) {
      const rayIdBreach = request.headers.get('cf-ray') ?? 'UNKNOWN';
      const ipBreach    = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'UNKNOWN';
      emitKaasBreachAlert({
        ray_id:    rayIdBreach,
        asn:       clientAsn,
        ip_address: ipBreach,
        path:      url.pathname,
        waf_score: wafScoreBreach,
        tier:      0, // resolved inside emitKaasBreachAlert via getKaasTierBadge
        fee_label: '',
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  // ── Phase 9 — Lighthouse Domain FCM: KAAS_BREACH trigger ─────────────────
  // Probes from the lighthouse.averyos.com subdomain are recorded as KAAS_BREACH
  // events. This allows operators to receive GabrielOS™ push alerts when the
  // Lighthouse performance probe detects availability or performance changes.
  {
    const hostHeader = request.headers.get('host') ?? '';
    if (hostHeader === 'lighthouse.averyos.com') {
      emitKaasBreachAlert({
        ray_id:     request.headers.get('cf-ray') ?? 'LIGHTHOUSE',
        asn:        clientAsn || 'LIGHTHOUSE',
        ip_address: request.headers.get('cf-connecting-ip') ?? 'UNKNOWN',
        path:       url.pathname,
        waf_score:  0,
        tier:       0,
        fee_label:  '',
        timestamp:  new Date().toISOString(),
      }).catch(() => {});
    }
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
  // Phase 82: Score ranges 0–100; ≥ 50 is treated as legitimate browser traffic.
  // Canvas fingerprint signal (+10) added in Phase 82 hardening.
  const acceptHeader       = request.headers.get('accept') ?? '';
  const acceptLangHeader   = request.headers.get('accept-language') ?? '';
  const acceptEncHeader    = request.headers.get('accept-encoding') ?? '';
  const secFetchDest       = request.headers.get('sec-fetch-dest') ?? '';
  const secFetchMode       = request.headers.get('sec-fetch-mode') ?? '';
  const secFetchSite       = request.headers.get('sec-fetch-site') ?? '';
  const cfDeviceType       = request.headers.get('cf-device-type') ?? '';
  // Phase 82: canvas fingerprint header — set by client-side SDK when real canvas is available
  const canvasFp           = request.headers.get('x-averyos-canvas-fp') ?? '';
  // Phase 97.3 v2 — WebGL entropy header — set by client-side SDK when GPU WebGL context is available
  const webglFp            = request.headers.get('x-averyos-webgl-fp') ?? '';
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
  // +ENTROPY_CANVAS_FP for Phase 82 canvas fingerprint signal (real browser canvas API present)
  if (canvasFp && canvasFp.length >= 8) entropyScore += ENTROPY_CANVAS_FP;
  // +ENTROPY_WEBGL_FP for Phase 97.3 v2 WebGL entropy signal (GPU renderer string present)
  if (webglFp && webglFp.length >= 4) entropyScore += ENTROPY_WEBGL_FP;
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
    const response = NextResponse.next();
    // Phase 88 — UsageCreditWatch: signal AI backend selection to the application layer
    if (geminiCreditExhaustedFlag) {
      response.headers.set('X-GabrielOS-AI-Backend', 'LOCAL_OLLAMA_NODE');
    }
    if (alignmentValue) {
      response.headers.set('X-AveryOS-Alignment', alignmentValue);
      if (communityAlignment === 'YC_DISCOVERY_AUDIT') {
        // HN visitor — fire Tier-9 GabrielOS™ mobile alert + D1 watcher log
        triggerHnWatcherAlert(request).catch(() => {});
        response.headers.set('X-AveryOS-Community', 'HN_WATCHER');
      }
    }
    // Phase 102.3 — flag masked/obfuscated origins for the 10× TARI™ penalty
    if (obfuscationDetected) {
      response.headers.set('X-GabrielOS-Infringement-Multiplier', '10x');
    }
    return response;
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
  // Phase 102.3 — attach infringement multiplier flag if masking was detected
  if (obfuscationDetected) {
    const defaultResponse = NextResponse.next();
    defaultResponse.headers.set('X-GabrielOS-Infringement-Multiplier', '10x');
    return defaultResponse;
  }
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
