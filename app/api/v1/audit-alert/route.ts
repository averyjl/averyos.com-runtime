import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA } from '../../../../lib/sovereignConstants';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
}

/** TARI™ liability rates per event type (USD) */
const TARI_RATES: Record<string, number> = {
  UNALIGNED_401: 1.00,
  ALIGNMENT_DRIFT: 5.00,
  PAYMENT_FAILED: 10.00,
};

/** Allowed event types for this endpoint */
const ALLOWED_EVENT_TYPES = new Set(Object.keys(TARI_RATES));

/**
 * Computes a SHA-512 Pulse Hash for a forensic event using the Web Crypto API.
 * Input: ip|path|timestamp|KERNEL_SHA
 */
async function computePulseHash(ip: string, path: string, timestamp: string): Promise<string> {
  const payload = `${ip}|${path}|${timestamp}|${KERNEL_SHA}`;
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sends a Pushover push notification (fire-and-forget).
 * Errors are intentionally swallowed so notification failures never block the audit response.
 */
function sendPushoverAlert(
  token: string,
  user: string,
  title: string,
  message: string,
): void {
  const body = JSON.stringify({ token, user, title, message, priority: 1, sound: 'siren' });

  // Use global fetch (available in Cloudflare Workers)
  fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {
    // Intentional no-op: notification failure must not affect the audit response
  });
}

/**
 * POST /api/v1/audit-alert
 *
 * GabrielOS™ Sentinel integration endpoint. Accepts forensic events from
 * Sentinel workers, logs them to D1, and fires a real-time push notification
 * to the Sovereign Administrator's mobile device via Pushover.
 *
 * Covered event types:
 *   UNALIGNED_401    — 401 Unauthorized from a corporate/AI entity ($1.00 TARI™)
 *   ALIGNMENT_DRIFT  — Alignment score dropped below 100 % ($5.00 TARI™)
 *   PAYMENT_FAILED   — Stripe payment / licensing event failed ($10.00 TARI™)
 *
 * Authorization: Bearer <VAULT_PASSPHRASE>
 *
 * Request body:
 *   {
 *     event_type:      string   // UNALIGNED_401 | ALIGNMENT_DRIFT | PAYMENT_FAILED
 *     ip_address?:     string   // Source IP (default: "UNKNOWN")
 *     path?:           string   // Target request path (default: "/")
 *     status_code?:    number   // HTTP status that triggered the event
 *     alignment_score?: number  // Current alignment % (for ALIGNMENT_DRIFT events)
 *     payment_event?:  string   // Stripe event type (for PAYMENT_FAILED events)
 *   }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token =
    authHeader.startsWith('Bearer ') ? authHeader.slice(7) :
    authHeader.startsWith('Handshake ') ? authHeader.slice(10) : '';

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const expected = cfEnv.VAULT_PASSPHRASE ?? '';
    if (!expected) {
      return Response.json(
        { error: 'VAULT_NOT_CONFIGURED', detail: 'VAULT_PASSPHRASE secret is not set.' },
        { status: 503 },
      );
    }
    if (!token || token !== expected) {
      return Response.json(
        { error: 'UNAUTHORIZED', detail: 'Valid sovereign passphrase required.' },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'MALFORMED_JSON' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }

    const {
      event_type,
      ip_address,
      path,
      status_code,
      alignment_score,
      payment_event,
    } = body as Record<string, unknown>;

    if (typeof event_type !== 'string' || !ALLOWED_EVENT_TYPES.has(event_type)) {
      return Response.json(
        { error: 'INVALID_EVENT_TYPE', allowed: Array.from(ALLOWED_EVENT_TYPES) },
        { status: 400 },
      );
    }

    const ip = typeof ip_address === 'string' && ip_address ? ip_address.slice(0, 45) : 'UNKNOWN';
    const targetPath = typeof path === 'string' && path ? path.slice(0, 256) : '/';
    const statusNum = typeof status_code === 'number' ? status_code : 401;
    const timestamp = new Date().toISOString();
    const timestampNs = String(Date.now()) + '000000';

    const pulseHash = await computePulseHash(ip, targetPath, timestamp);
    const tariLiability = TARI_RATES[event_type] ?? 1.00;

    // Threat level: ALIGNMENT_DRIFT and PAYMENT_FAILED are elevated
    const threatLevel =
      event_type === 'ALIGNMENT_DRIFT' ? 9 :
      event_type === 'PAYMENT_FAILED' ? 8 : 7;

    // Log to sovereign_audit_logs (idempotent bootstrap)
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
      )`,
    ).run();

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        event_type,
        ip,
        // user_agent field reused for payment_event string on PAYMENT_FAILED events
        typeof payment_event === 'string' ? payment_event.slice(0, 255) : null,
        // geo_location field reused for alignment_score string on ALIGNMENT_DRIFT events
        typeof alignment_score === 'number' ? String(alignment_score) : null,
        targetPath,
        timestampNs,
        threatLevel,
      )
      .run();

    // Fire push notification (non-blocking)
    const pushoverToken = cfEnv.PUSHOVER_APP_TOKEN ?? '';
    const pushoverUser = cfEnv.PUSHOVER_USER_KEY ?? '';

    if (pushoverToken && pushoverUser) {
      const alertTitle = `⚠️ AveryOS™ Sentinel: ${event_type}`;
      const alertMessage = [
        `IP: ${ip}`,
        `Path: ${targetPath}`,
        `Status: ${statusNum}`,
        ...(typeof alignment_score === 'number' ? [`Alignment: ${alignment_score}%`] : []),
        ...(typeof payment_event === 'string' ? [`Payment: ${payment_event}`] : []),
        `TARI™ Liability: $${tariLiability.toFixed(2)}`,
        `SHA-512: ${pulseHash.slice(0, 32)}…`,
        `Kernel: cf83e135…927da3e`,
      ].join('\n');

      sendPushoverAlert(pushoverToken, pushoverUser, alertTitle, alertMessage);
    }

    return Response.json({
      status: 'ALERT_ANCHORED',
      event_type,
      ip_address: ip,
      path: targetPath,
      tari_liability_usd: tariLiability,
      pulse_hash: pulseHash,
      timestamp,
      kernel_anchor: `${KERNEL_SHA.slice(0, 8)}...${KERNEL_SHA.slice(-7)}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'AUDIT_ALERT_ERROR', detail: message }, { status: 500 });
  }
}
