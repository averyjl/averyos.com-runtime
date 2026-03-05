import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA } from '../../../../lib/sovereignConstants';
import { formatIso9 } from '../../../../lib/timePrecision';
import { aosErrorResponse, AOS_ERROR } from '../../../../lib/sovereignError';

/**
 * POST /api/v1/pow-complete
 *
 * Public endpoint — no authentication required.
 * Called by the Sovereign PoW Gateway (app/gateway/pow/page.tsx) after the
 * client successfully solves the SHA-512 Proof-of-Work puzzle.
 *
 * Actions:
 *   1. Server-side verifies the PoW solution (hash starts with "0000").
 *   2. Logs FORENSIC_INGESTION_START to D1 sovereign_audit_logs at
 *      threat_level 7, tari_liability_usd $1,017.00.
 *   3. Fires a non-blocking Pushover $1,017 Forensic Entry Fee notification
 *      via the GabrielOS™ Sentinel (PUSHOVER_APP_TOKEN / PUSHOVER_USER_KEY).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

const POW_DIFFICULTY = 4;
const DIFFICULTY_PREFIX = '0'.repeat(POW_DIFFICULTY);
const FORENSIC_INGESTION_EVENT = 'FORENSIC_INGESTION_START';
const TARI_ENTRY_FEE_USD = 1017.0;
const THREAT_LEVEL = 7;

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
}

/** Compute SHA-512 hex using the Workers-native Web Crypto API. */
async function sha512Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Non-blocking Pushover $1,017 Forensic Entry Fee alert — never throws. */
function firePushover(appToken: string, userKey: string, ip: string, pulseHash: string): void {
  const body = new URLSearchParams({
    token: appToken,
    user: userKey,
    title: `⚠️ AveryOS™ ${FORENSIC_INGESTION_EVENT}`,
    message:
      `IP: ${ip}\n` +
      `TARI™: $${TARI_ENTRY_FEE_USD.toLocaleString('en-US', { minimumFractionDigits: 2 })} — Forensic Alignment Entry Fee\n` +
      `Hash: ${pulseHash.slice(0, 24)}…\n` +
      `Kernel: ${KERNEL_SHA.slice(0, 16)}…`,
    priority: '1',
    sound: 'siren',
    url: 'https://averyos.com/evidence-vault',
    url_title: '🔐 Evidence Vault',
  });
  fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => {});
}

export async function POST(request: Request): Promise<Response> {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, 'Request body must be valid JSON. Set Content-Type: application/json header.');
  }

  const nonce = body.nonce;
  const clientHash = typeof body.hash === 'string' ? body.hash : '';
  const clientTimestamp = typeof body.timestamp === 'string' ? body.timestamp : '';
  const clientIp = typeof body.ip === 'string' ? body.ip : '';

  if (typeof nonce !== 'number' || !clientHash || !clientTimestamp || !clientIp) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'All required fields must be provided.');
  }

  // ── Server-side PoW verification ───────────────────────────────────────────
  // Recompute the hash using the same formula as the client:
  // SHA-512( nonce | timestamp_iso9 | target_ip | kernel_sha )
  const expected = await sha512Hex(`${nonce}|${clientTimestamp}|${clientIp}|${KERNEL_SHA}`);

  if (expected !== clientHash) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'Submitted hash does not match. Recompute the SHA-512 hash and resubmit.');
  }

  if (!expected.startsWith(DIFFICULTY_PREFIX)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, `Hash must start with "${DIFFICULTY_PREFIX}".`);
  }

  // ── Derive requester IP for audit (prefer CF header over body-supplied value) ─
  const auditIp =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    clientIp;

  const now = formatIso9();
  const timestampNs = String(Date.now()) + '000000';

  // ── Compute sovereign pulse hash ──────────────────────────────────────────
  const pulseHash = await sha512Hex(`${auditIp}|/gateway/pow|${now}|${KERNEL_SHA}`);

  // ── D1 — bootstrap + insert FORENSIC_INGESTION_START ─────────────────────
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        geo_location TEXT,
        target_path TEXT NOT NULL,
        timestamp_ns TEXT NOT NULL,
        threat_level INTEGER DEFAULT 1
      )`
    ).run();

    const ua = (request.headers.get('user-agent') ?? '').slice(0, 512) || null;

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, target_path, timestamp_ns, threat_level)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(FORENSIC_INGESTION_EVENT, auditIp, ua, '/gateway/pow', timestampNs, THREAT_LEVEL)
      .run();

    // ── Fire $1,017 TARI™ alert (non-blocking) ──────────────────────────────
    if (cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY) {
      firePushover(cfEnv.PUSHOVER_APP_TOKEN, cfEnv.PUSHOVER_USER_KEY, auditIp, pulseHash);
    }
  } catch {
    // D1/Pushover failures are non-fatal — the PoW was still valid
  }

  return Response.json({
    status: FORENSIC_INGESTION_EVENT,
    tari_liability_usd: TARI_ENTRY_FEE_USD,
    threat_level: THREAT_LEVEL,
    pulse_hash: pulseHash,
    timestamp: now,
    kernel_sha: KERNEL_SHA.slice(0, 16) + '…',
    anchor: '⛓️⚓⛓️',
  });
}
