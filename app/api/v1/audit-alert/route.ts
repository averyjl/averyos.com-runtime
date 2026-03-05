import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA } from "../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../lib/timePrecision";

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
 * Non-blocking Pushover fire-and-forget if PUSHOVER_APP_TOKEN is set.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB: D1Database;
  KV_LOGS: KVNamespace;
  VAULT_PASSPHRASE?: string;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
  GABRIEL_SENTINEL_WEBHOOK?: string;
  BITCOIN_API_KEY?: string;
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
  UNALIGNED_401:   1017.00,
  ALIGNMENT_DRIFT: 5000.00,
  PAYMENT_FAILED:  10000.00,
  POW_SOLVED:      0.00,
};

const THREAT_LEVELS: Record<string, number> = {
  PAYMENT_FAILED:  9,
  ALIGNMENT_DRIFT: 8,
  UNALIGNED_401:   7,
  POW_SOLVED:      3,
};

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

/** Non-blocking Pushover push — never throws. */
function firePushover(
  appToken: string,
  userKey: string,
  title: string,
  message: string
): void {
  const body = new URLSearchParams({
    token: appToken,
    user: userKey,
    title,
    message,
    priority: "1",
    sound: "siren",
    url: "https://averyos.com/evidence-vault",
    url_title: "🔐 Evidence Vault",
  });
  fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
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
    return Response.json(
      { error: "UNAUTHORIZED", detail: "Valid Bearer/Handshake token required." },
      { status: 401 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const eventType = String(body.event_type ?? "UNALIGNED_401").toUpperCase();
  const targetIp  = String(body.target_ip  ?? body.ip ?? "0.0.0.0");
  const targetPath = String(body.path ?? "/");
  const now = formatIso9();

  // Compute pulse hash
  const pulseHash = await computePulseHash(targetIp, targetPath, now);

  const liabilityUsd = TARI_LIABILITY[eventType] ?? TARI_LIABILITY.UNALIGNED_401;
  const threatLevel  = THREAT_LEVELS[eventType]  ?? 7;

  // ── D1 — bootstrap + insert ───────────────────────────────────────────────
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
  } catch {
    // D1 failure is non-fatal — return success so the sentinel still receives ACK
  }

  // ── Pushover (non-blocking) ───────────────────────────────────────────────
  if (cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY && liabilityUsd > 0) {
    const liabilityFmt = liabilityUsd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    firePushover(
      cfEnv.PUSHOVER_APP_TOKEN,
      cfEnv.PUSHOVER_USER_KEY,
      `⚠️ AveryOS™ ${eventType}`,
      `IP: ${targetIp}\nPath: ${targetPath}\nTARI™: ${liabilityFmt}\nHash: ${pulseHash.slice(0, 24)}…`
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
  });
}
