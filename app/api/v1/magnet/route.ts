/**
 * GET /api/v1/magnet
 *
 * AveryOS™ Transparent Magnet Beacon — GATE 117.8.3
 *
 * A transparent, sovereign IP-tracking endpoint.  When any client (bot,
 * crawler, AI model, or human) fetches this URL:
 *
 *   1. The request RayID, IP address, and path are logged to D1
 *      (`magnet_hits` table) for forensic audit — BEFORE any redirect.
 *   2. The hit is mirrored to Firebase Firestore (`averyos-d1-sync/`
 *      collection) for real-time dashboard visibility.
 *   3. A 302 redirect is issued to the AveryOS™ IP Policy page, ensuring
 *      the caller receives a human-readable acknowledgement.
 *
 * High-value callers (Microsoft, Google, Amazon — matching known ASNs) are
 * classified as MAGNET_HIT Tier-9 events and trigger a Pushover / FCM alert.
 *
 * This endpoint is intentionally listed in robots.txt as a no-crawl target,
 * which causes compliant bots to deliberately avoid it — and non-compliant
 * bots (scrapers, shadow-crawlers) to trigger it.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { syncD1RowToFirebase, sendFcmV1Push } from "../../../../lib/firebaseClient";

// ── Local type interfaces ──────────────────────────────────────────────────────

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}
interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
}
interface KVNamespace {
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface CloudflareEnv {
  DB:                    D1Database;
  KV_LOGS:               KVNamespace;
  PUSHOVER_APP_TOKEN?:   string;
  PUSHOVER_USER_KEY?:    string;
  SITE_URL?:             string;
  NEXT_PUBLIC_SITE_URL?: string;
}

// ── High-value ASN map (TARI™ KaaS Tier lookup) ───────────────────────────────
const HIGH_VALUE_ASNS = new Set([
  "8075",   // Microsoft / Azure
  "15169",  // Google LLC
  "36459",  // GitHub, Inc.
  "16509",  // Amazon / AWS
  "14618",  // Amazon
  "32934",  // Meta / Facebook
]);

// ── Compute SHA-512 pulse hash for forensic anchoring ─────────────────────────
async function computeMagnetHash(ip: string, rayId: string, ts: string): Promise<string> {
  const input = `MAGNET|${ip}|${rayId}|${ts}|${KERNEL_SHA}`;
  const buf   = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Pushover alert for high-value hits ────────────────────────────────────────
function firePushoverAlert(
  appToken: string,
  userKey:  string,
  ip:       string,
  rayId:    string,
  asn:      string,
  ts:       string,
): void {
  const message = `🧲 MAGNET HIT\nASN: ${asn}\nIP: ${ip}\nRayID: ${rayId}\nTime: ${ts}`;
  fetch("https://api.pushover.net/1/messages.json", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      token:    appToken,
      user:     userKey,
      title:    "⚡ MAGNET_HIT — AveryOS™ Sentinel",
      message,
      priority: "1",
      sound:    "siren",
    }).toString(),
  }).catch(() => {/* fire-and-forget */});
}

// ── Ensure the magnet_hits table exists ───────────────────────────────────────
async function ensureMagnetHitsTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS magnet_hits (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      hit_at     TEXT    NOT NULL,
      ip_address TEXT    NOT NULL,
      ray_id     TEXT,
      asn        TEXT,
      user_agent TEXT,
      pulse_hash TEXT    NOT NULL,
      tier       INTEGER NOT NULL DEFAULT 0,
      kernel_sha TEXT    NOT NULL
    )
  `).run();
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  const ip          = request.headers.get("cf-connecting-ip")             ?? "unknown";
  const rayId       = request.headers.get("cf-ray")                       ?? "";
  const asn         = request.headers.get("cf-autonomous-system-number")  ?? "";
  const userAgent   = request.headers.get("user-agent")                   ?? "";
  const now         = formatIso9();
  const isHighValue = HIGH_VALUE_ASNS.has(asn.replace(/^AS/i, "").trim());
  const tier        = isHighValue ? 9 : 1;

  // ── 1. Compute forensic pulse hash ────────────────────────────────────────
  const pulseHash = await computeMagnetHash(ip, rayId, now);

  // ── 2. Write to D1 (BEFORE redirect) ─────────────────────────────────────
  if (cfEnv.DB) {
    try {
      await ensureMagnetHitsTable(cfEnv.DB);
      await cfEnv.DB.prepare(`
        INSERT INTO magnet_hits
          (hit_at, ip_address, ray_id, asn, user_agent, pulse_hash, tier, kernel_sha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        now, ip, rayId || null, asn || null, userAgent || null, pulseHash, tier, KERNEL_SHA,
      ).run();
    } catch {
      // D1 write failure is non-fatal — log to KV as fallback
      try {
        await cfEnv.KV_LOGS?.put(
          `magnet_hit:${now}:${ip}`,
          JSON.stringify({ hit_at: now, ip, ray_id: rayId, asn, user_agent: userAgent, pulse_hash: pulseHash, tier }),
          { expirationTtl: 86_400 },
        );
      } catch {/* KV fallback also non-fatal */}
    }
  }

  // ── 3. Mirror to Firebase (fire-and-forget, uses D1 row shape) ───────────
  syncD1RowToFirebase({
    id:           `magnet-${now}-${ip.replace(/\./g, "-")}`,
    event_type:   "MAGNET_HIT",
    ip_address:   ip,
    target_path:  "/api/v1/magnet",
    threat_level: tier,
    pulse_hash:   pulseHash,
    timestamp_ns: now,
  }).catch(() => {/* fire-and-forget */});

  // ── 4. FCM push for high-value hits (Tier-9) ─────────────────────────────
  if (isHighValue) {
    sendFcmV1Push(
      "⚡ MAGNET_HIT Tier-9",
      `ASN ${asn} | IP ${ip} | RayID ${rayId}`,
      { event_type: "MAGNET_HIT", asn, ip, ray_id: rayId, tier: String(tier), phase: "117.8.3" },
    ).catch(() => {/* fire-and-forget */});
  }

  // ── 5. Pushover alert for high-value hits ─────────────────────────────────
  if (isHighValue && cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY) {
    firePushoverAlert(cfEnv.PUSHOVER_APP_TOKEN, cfEnv.PUSHOVER_USER_KEY, ip, rayId, asn, now);
  }

  // ── 6. Redirect to IP Policy page (after all writes are dispatched) ───────
  const siteUrl = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
  return Response.redirect(`${siteUrl}/ip-policy`, 302);
}

// Support HEAD preflight
export async function HEAD(_request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    const siteUrl = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
    return new Response(null, {
      status:  200,
      headers: {
        "X-AveryOS-Kernel":           KERNEL_VERSION,
        "X-AveryOS-Sovereign-Anchor": "⛓️⚓⛓️",
        "X-Magnet-Beacon":            "ACTIVE",
        "Location":                   `${siteUrl}/ip-policy`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, msg);
  }
}
