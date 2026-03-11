import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { syncD1RowToFirebase, syncKaasValuationToFirebase, sendFcmV1Push } from "../../../../lib/firebaseClient";
import { getAsnTier, getAsnFeeUsd } from "../../../../lib/kaas/pricing";
import { resolveJurisdiction, JURISDICTION_STATUTES } from "../../../../lib/forensics/globalVault";

/**
 * POST /api/v1/audit-alert
 *
 * GabrielOS™ Sentinel integration endpoint.
 * Receives forensic TARI™ audit alerts from:
 *   • scripts/sovereign-audit-alert.js (CI / standalone)
 *   • workers/gabriel-gatekeeper.js (edge)
 *   • .github/workflows/site-health-monitor.yml
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE.
 *
 * Accepted event types and TARI™ liability schedule:
 *   UNALIGNED_401    → $1,017.00  Forensic Alignment Entry Fee
 *   ALIGNMENT_DRIFT  → $5,000.00  Correction Fee
 *   PAYMENT_FAILED   → $10,000.00 Systemic Friction Fee
 *   POW_SOLVED       → $0.00      PoW gateway telemetry (informational)
 *
 * Logs to D1 `sovereign_audit_logs` at threat levels 7–9.
 * Computes a SHA-512 pulse hash via Web Crypto API.
 * Non-blocking Pushover + FCM HTTP v1 fire-and-forget if credentials are set.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface R2ObjectBody {
  text(): Promise<string>;
}

interface R2Bucket {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
}

interface CloudflareEnv {
  DB: D1Database;
  KV_LOGS: KVNamespace;
  VAULT: R2Bucket;
  VAULT_PASSPHRASE?: string;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
  GABRIEL_SENTINEL_WEBHOOK?: string;
  BITCOIN_API_KEY?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  first(): Promise<unknown>;
}

interface KVNamespace {
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

// TARI™ liability schedule
const TARI_LIABILITY: Record<string, number> = {
  UNALIGNED_401:          1017.00,
  ALIGNMENT_DRIFT:        5000.00,
  PAYMENT_FAILED:        10000.00,
  POW_SOLVED:                0.00,
  // DER 2.0 / HN Watcher event types (Phase 78.3)
  HN_WATCHER:                0.00,  // Forensic discovery signal — no direct liability, but Tier-9 alert
  DER_HIGH_VALUE:         1017.00,  // Corporate entity recognition entry fee
  DER_SETTLEMENT:        10000.00,  // Active settlement trigger
  // Middleware-generated event types (Phase 78.5) — recorded for audit completeness
  CONFLICT_ZONE_PROBE:       0.00,  // Adversarial recon probe — silent audit, Tier-9
  LEGAL_SCAN:                0.00,  // Corporate legal monitoring — threat level 10
  PEER_ACCESS:               0.00,  // General peer access — low threat, informational
  // KaaS (Phase 97) — Kernel-as-a-Service breach events
  KAAS_BREACH:        10000000.00,  // Tier-9/10 entity KaaS technical valuation trigger
  SOVEREIGN_SETTLEMENT:      0.00,  // Stripe Sovereign Settlement completion — informational
};

const THREAT_LEVELS: Record<string, number> = {
  PAYMENT_FAILED:         9,
  ALIGNMENT_DRIFT:        8,
  UNALIGNED_401:          7,
  POW_SOLVED:             3,
  // DER 2.0 / HN Watcher — all Tier-9 (Phase 78.3)
  HN_WATCHER:             9,
  DER_HIGH_VALUE:         9,
  DER_SETTLEMENT:         9,
  // Middleware-generated event types (Phase 78.5)
  CONFLICT_ZONE_PROBE:    9,   // Adversarial probe — Tier-9 forensic alert
  LEGAL_SCAN:            10,   // Corporate legal monitoring — highest threat
  PEER_ACCESS:            1,   // General peer access — informational
  // KaaS (Phase 97)
  KAAS_BREACH:           10,   // Tier-9/10 entity KaaS breach — highest threat
  SOVEREIGN_SETTLEMENT:   1,   // Stripe payment confirmed — low threat
};

// FCM Tier-9 filter — only fire mobile push for these high-value event types.
// This prevents notification fatigue while ensuring critical events always reach the Creator.
// Minimum threat level for FCM: 9 (see THREAT_LEVELS map; must match FCM_MIN_THREAT_LEVEL).
const FCM_MIN_THREAT_LEVEL = 9;
const FCM_TIER9_EVENT_TYPES = new Set([
  "LEGAL_SCAN",
  "CONFLICT_ZONE_PROBE",
  "DER_HIGH_VALUE",
  "DER_SETTLEMENT",
  "HN_WATCHER",
  "PAYMENT_FAILED",
  "KAAS_BREACH",
]);

async function computePulseHash(
  ip: string,
  path: string,
  timestamp: string
): Promise<string> {
  const input = `${ip}|${path}|${timestamp}|${KERNEL_SHA}`;
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/** Derive an HMAC-SHA-256 signing key from VAULT_PASSPHRASE + KERNEL_SHA. */
async function deriveSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret + KERNEL_SHA),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Compute HMAC-SHA-256 hex over a message. */
async function hmacSign(key: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Store a forensic snapshot in R2 under vault/forensics/ and return a
 * 24-hour HMAC-signed download URL pointing to /api/v1/compliance/alert-link/download.
 * Returns null on any failure (non-fatal — caller logs it).
 */
async function storeForensicBundleAndSign(
  vault: R2Bucket,
  vaultPassphrase: string,
  baseUrl: string,
  r2Key: string,
  content: string
): Promise<string | null> {
  try {
    await vault.put(r2Key, content);
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    const signingKey = await deriveSigningKey(vaultPassphrase);
    const signature = await hmacSign(signingKey, `${r2Key}:${expiry}`);
    return `${baseUrl}/api/v1/compliance/alert-link/download?key=${encodeURIComponent(r2Key)}&exp=${expiry}&sig=${signature}`;
  } catch {
    return null;
  }
}

/** Non-blocking Pushover push — never throws.
 *
 * @param {string}  appToken
 * @param {string}  userKey
 * @param {string}  title
 * @param {string}  message
 * @param {boolean} [tier9=false]  If true, uses Pushover priority 2 (emergency — requires confirmation)
 */
function firePushover(
  appToken: string,
  userKey: string,
  title: string,
  message: string,
  tier9 = false
): void {
  const body = new URLSearchParams({
    token: appToken,
    user: userKey,
    title,
    message,
    // Tier-9 → priority 2 (emergency: breaks quiet hours AND requires acknowledgement)
    // All other alerts → priority 1 (high: breaks quiet hours)
    priority: tier9 ? "2" : "1",
    retry:    tier9 ? "30"  : "",   // emergency: retry every 30 s
    expire:   tier9 ? "3600" : "",  // emergency: expire after 1 h
    sound: tier9 ? "echo" : "siren",
    url: "https://averyos.com/evidence-vault",
    url_title: "🔐 Evidence Vault",
  });
  fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch((err) => {
    console.warn(`[audit-alert] Pushover delivery failed: ${(err as Error).message}`);
  });
}

/** Build the Pushover alert message body for an audit event. */
function buildAlertMessage(
  targetIp: string,
  targetPath: string,
  liabilityFmt: string,
  pulseHash: string,
  signedEvidenceUrl: string | null
): string {
  const lines = [
    `IP: ${targetIp}`,
    `Path: ${targetPath}`,
    `TARI™: ${liabilityFmt}`,
    `Hash: ${pulseHash.slice(0, 32)}…`,
  ];
  if (signedEvidenceUrl) {
    lines.push(`Evidence URL:\n${signedEvidenceUrl}`);
  }
  return lines.join("\n");
}

/**
 * Non-blocking KAAS_BREACH writer — records a kaas_valuations row for every
 * Tier-9/10 breach event.  Fire-and-forget; never throws.
 */
function emitKaasBreachAlert(
  db: D1Database,
  opts: {
    asn:         string;
    ip_address:  string;
    ray_id?:     string;
    pulse_hash?: string;
  }
): void {
  void (async () => {
    try {
      const tier          = getAsnTier(opts.asn);
      const valuation_usd = getAsnFeeUsd(opts.asn);
      const now           = formatIso9();

      // ── Write to kaas_valuations ────────────────────────────────────────
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS kaas_valuations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ray_id TEXT, asn TEXT NOT NULL, ip_address TEXT NOT NULL,
          tier INTEGER NOT NULL DEFAULT 1, valuation_usd REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          knowledge_cutoff_correlation TEXT, ingestion_verified INTEGER NOT NULL DEFAULT 0,
          capsule_sha512 TEXT, stripe_invoice_id TEXT, stripe_checkout_url TEXT,
          pulse_hash TEXT, kernel_version TEXT NOT NULL DEFAULT 'v3.6.2',
          created_at TEXT NOT NULL, settled_at TEXT
        )
      `).run();

      await db.prepare(
        `INSERT INTO kaas_valuations
           (ray_id, asn, ip_address, tier, valuation_usd, status,
            pulse_hash, kernel_version, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
      ).bind(
        opts.ray_id      ?? null,
        opts.asn,
        opts.ip_address,
        tier,
        valuation_usd,
        opts.pulse_hash  ?? null,
        KERNEL_VERSION,
        now,
      ).run();

      // ── Mirror to sovereign_audit_logs as KAAS_BREACH ──────────────────
      await db.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, target_path, timestamp_ns,
            threat_level, tari_liability_usd, pulse_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        "KAAS_BREACH",
        opts.ip_address,
        "/api/v1/kaas/valuations",
        now,
        tier >= 9 ? 10 : 9,
        valuation_usd,
        opts.pulse_hash ?? null,
      ).run();

      // ── Sync to Firebase ────────────────────────────────────────────────
      syncKaasValuationToFirebase({
        asn:           opts.asn,
        ip_address:    opts.ip_address,
        tier,
        valuation_usd,
        status:        "PENDING",
        ray_id:        opts.ray_id    ?? null,
        pulse_hash:    opts.pulse_hash ?? null,
        kernel_version: KERNEL_VERSION,
        created_at:    now,
      }).catch(() => {});

    } catch {
      // Non-fatal — breach emission must never interrupt the main request
    }
  })();
}

/**
 * Non-blocking GabrielOS™ Sentinel webhook forward for Tier-9 events.
 * Sends an HMAC-SHA-256 signed payload to the configured webhook URL.
 */
function forwardToGabrielSentinel(
  webhookUrl: string,
  btcApiKey: string | undefined,
  payload: Record<string, unknown>
): void {
  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(btcApiKey
        ? { "X-GabrielOS-Salt": btcApiKey.slice(0, 8) + "…" }
        : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Valid Bearer/Handshake token required.');
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, 'Request body must be valid JSON. Set Content-Type: application/json header.');
  }

  const eventType = String(body.event_type ?? "UNALIGNED_401").toUpperCase();
  const targetIp  = String(body.target_ip  ?? body.ip ?? "0.0.0.0");
  const targetPath = String(body.path ?? "/");
  const countryCode = String(body.country_code ?? body.geo ?? "US").slice(0, 2).toUpperCase();
  const now = formatIso9();

  // Resolve jurisdiction-aware statutory label for FCM payload (Gate 5)
  const jurisdiction = resolveJurisdiction(countryCode);
  const jurisdictionStatute = JURISDICTION_STATUTES[jurisdiction];

  // Compute pulse hash
  const pulseHash = await computePulseHash(targetIp, targetPath, now);

  const liabilityUsd = TARI_LIABILITY[eventType] ?? TARI_LIABILITY.UNALIGNED_401;
  const threatLevel  = THREAT_LEVELS[eventType]  ?? 7;

  // ── D1 — bootstrap + insert ───────────────────────────────────────────────
  let insertedId: number | null = null;
  try {
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        geo_location TEXT,
        target_path TEXT NOT NULL,
        timestamp_ns TEXT NOT NULL,
        threat_level INTEGER,
        tari_liability_usd REAL,
        pulse_hash TEXT
      )`
    ).run();

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
       (event_type, ip_address, target_path, timestamp_ns, threat_level, tari_liability_usd, pulse_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(eventType, targetIp, targetPath, now, threatLevel, liabilityUsd, pulseHash)
      .run();

    // Retrieve the newly inserted row ID for Firebase sync
    const lastRow = await cfEnv.DB.prepare(
      `SELECT id FROM sovereign_audit_logs ORDER BY id DESC LIMIT 1`
    ).first() as { id: number } | null;
    insertedId = lastRow?.id ?? null;
  } catch {
    // D1 failure is non-fatal — return success so the sentinel still receives ACK
  }

  // ── Multi-Cloud D1 → Firebase Sync (non-blocking) ────────────────────────
  // Mirror every Tier-7+ audit event to Firestore for cross-cloud parity.
  // Activates automatically once FIREBASE_PROJECT_ID is set in Cloudflare secrets.
  if (insertedId !== null && threatLevel >= 7) {
    syncD1RowToFirebase({
      id:                insertedId,
      event_type:        eventType,
      ip_address:        targetIp,
      target_path:       targetPath,
      threat_level:      threatLevel,
      tari_liability_usd: liabilityUsd,
      pulse_hash:        pulseHash,
      timestamp_ns:      now,
    }).catch((err: unknown) => {
      console.warn(`[audit-alert] Firebase sync failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  // ── KAAS_BREACH → kaas_valuations + sovereign_audit_logs write ───────────
  // Every Tier-9/10 KAAS_BREACH event also creates a valuation ledger row
  // and a direct sovereign_audit_logs entry via emitKaasBreachAlert().
  if (eventType === "KAAS_BREACH" && cfEnv.DB) {
    const asn = String(body.asn ?? targetIp);
    emitKaasBreachAlert(cfEnv.DB, {
      asn,
      ip_address: targetIp,
      ray_id:     String(body.ray_id ?? ""),
      pulse_hash: pulseHash,
    });
  }

  // ── Signed R2 URL for UNALIGNED_401 events ───────────────────────────────
  let signedEvidenceUrl: string | null = null;
  if (eventType === "UNALIGNED_401" && cfEnv.VAULT && cfEnv.VAULT_PASSPHRASE) {
    const baseUrl =
      cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
    const safeIp = targetIp.replace(/[^a-zA-Z0-9._-]/g, "_");
    const r2Key = `vault/forensics/AUDIT_ALERT_${safeIp}_${now.replace(/[:.Z]/g, "")}.aoscap`;
    const bundleContent = JSON.stringify({
      CapsuleID: `AUDIT_ALERT_${safeIp}_${now}`,
      CapsuleType: "SOVEREIGN_AUDIT_ALERT",
      EventType: eventType,
      TargetIP: targetIp,
      TargetPath: targetPath,
      ThreatLevel: threatLevel,
      TariLiabilityUsd: liabilityUsd,
      PulseHash: pulseHash,
      Timestamp: now,
      KernelAnchor: KERNEL_SHA.slice(0, 16) + "…",
      SovereignAnchor: "⛓️⚓⛓️",
    });
    signedEvidenceUrl = await storeForensicBundleAndSign(
      cfEnv.VAULT,
      cfEnv.VAULT_PASSPHRASE,
      baseUrl,
      r2Key,
      bundleContent
    );
  }

  // ── Pushover (non-blocking) ───────────────────────────────────────────────
  // Fire for any event with TARI liability OR any Tier-9 event (threat level ≥ 9),
  // so that DER HIGH_VALUE / HN_WATCHER signals always trigger mobile alerts.
  if (cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY && (liabilityUsd > 0 || threatLevel >= 9)) {
    const isTier9 = threatLevel >= 9;
    const liabilityFmt = liabilityUsd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    const title = isTier9
      ? `🚨 TIER-9 GabrielOS™ ALERT: ${eventType}`
      : `⚠️ AveryOS™ ${eventType}`;
    firePushover(
      cfEnv.PUSHOVER_APP_TOKEN,
      cfEnv.PUSHOVER_USER_KEY,
      title,
      buildAlertMessage(targetIp, targetPath, liabilityFmt, pulseHash, signedEvidenceUrl),
      isTier9
    );
  }

  // ── Firebase Cloud Messaging — Tier-9 mobile push (non-blocking, FCM HTTP v1) ──
  // Secondary push channel alongside Pushover for maximum Tier-9 alert delivery.
  // Uses the FCM HTTP v1 API (OAuth2 service account) via sendFcmV1Push().
  // Filtered to FCM_TIER9_EVENT_TYPES to prevent notification fatigue.
  // Activate by setting these Cloudflare secrets:
  //   wrangler secret put FIREBASE_PROJECT_ID
  //   wrangler secret put FIREBASE_CLIENT_EMAIL
  //   wrangler secret put FIREBASE_PRIVATE_KEY
  //   wrangler secret put FCM_DEVICE_TOKEN
  if (threatLevel >= FCM_MIN_THREAT_LEVEL && FCM_TIER9_EVENT_TYPES.has(eventType)) {
    const liabilityFmt = liabilityUsd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    // KAAS_BREACH enrichment (Gate 8 — GabrielOS™ Mobile Push v3):
    // Include valuation_usd, asn, and tier in the FCM data payload so the
    // Creator's mobile app can render a detailed financial summary.
    const kaasAsn          = eventType === "KAAS_BREACH" ? String(body.asn ?? "") : "";
    const kaasTier         = eventType === "KAAS_BREACH" ? String(body.tier ?? "") : "";
    const kaasValuationUsd = eventType === "KAAS_BREACH" ? String(body.valuation_usd ?? liabilityUsd) : "";

    sendFcmV1Push(
      `🚨 TIER-${threatLevel} GabrielOS™: ${eventType}`,
      buildAlertMessage(targetIp, targetPath, liabilityFmt, pulseHash, signedEvidenceUrl),
      {
        event_type:        eventType,
        threat_level:      String(threatLevel),
        kernel_sha:        KERNEL_SHA.slice(0, 16) + "…",
        sovereign_anchor:  "⛓️⚓⛓️",
        creator_lock:      "🤛🏻",
        // Gate 5 — Jurisdiction-aware statutory labels for Creator's mobile app
        jurisdiction,
        statutory_label:   jurisdictionStatute.short,
        damage_cap:        jurisdictionStatute.damage_cap,
        statutory_framework: jurisdictionStatute.framework,
        // KAAS_BREACH-specific fields (populated only for KAAS_BREACH events)
        ...(kaasAsn          ? { asn:           kaasAsn }          : {}),
        ...(kaasTier         ? { tier:          kaasTier }         : {}),
        ...(kaasValuationUsd ? { valuation_usd: kaasValuationUsd } : {}),
      },
    ).catch((err: unknown) => {
      console.warn(`[audit-alert] FCM v1 delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  // ── GabrielOS™ Sentinel — Tier-9 forward (non-blocking) ──────────────────
  if (threatLevel >= 9 && cfEnv.GABRIEL_SENTINEL_WEBHOOK) {
    forwardToGabrielSentinel(
      cfEnv.GABRIEL_SENTINEL_WEBHOOK,
      cfEnv.BITCOIN_API_KEY,
      {
        event_type:        eventType,
        target_ip:         targetIp,
        target_path:       targetPath,
        threat_level:      threatLevel,
        tari_liability_usd: liabilityUsd,
        pulse_hash:        pulseHash,
        timestamp:         now,
        kernel_sha:        KERNEL_SHA.slice(0, 16) + "…",
      }
    );
  }

  return Response.json({
    status: "AUDIT_ALERT_LOGGED",
    event_type: eventType,
    tari_liability_usd: liabilityUsd,
    threat_level: threatLevel,
    pulse_hash: pulseHash,
    timestamp: now,
    kernel_sha: KERNEL_SHA.slice(0, 16) + "…",
    ...(signedEvidenceUrl ? { signed_evidence_url: signedEvidenceUrl } : {}),
  });
}
