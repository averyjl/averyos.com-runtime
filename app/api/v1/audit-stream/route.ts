import { getCloudflareContext } from '@opennextjs/cloudflare';
import { formatIso9 } from '../../../../lib/timePrecision';
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from '../../../../lib/sovereignError';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_PASSPHRASE?: string;
}

export interface AuditStreamEntry {
  id: number;
  event_type: string;
  ip_address: string;
  user_agent: string | null;
  geo_location: string | null;
  target_path: string;
  timestamp_ns: string;
  threat_level: number | null;
}

/** Format a nanosecond timestamp string as a Forensic Pulse: YYYY-MM-DD.HHMMSSmmm000000 */
function formatForensicPulse(timestamp_ns: string): string {
  const ms = Number(timestamp_ns.slice(0, 13));
  if (Number.isNaN(ms)) return timestamp_ns;
  const date = new Date(ms);
  const iso = formatIso9(date);
  // Convert 2026-03-01T01:08:17.001000000Z → 2026-03-01.0108171010000
  const tIndex = iso.indexOf('T');
  if (tIndex === -1) return iso;
  const datePart = iso.slice(0, tIndex);
  const timePart = iso.slice(tIndex + 1);
  const compact = timePart.replace(/[:Z]/g, '').replace('.', '');
  return `${datePart}.${compact}`;
}

export async function GET(request: Request) {
  // Accepts Bearer scheme (SovereignAuditStream) and Handshake scheme (SovereignAuditLog)
  const authHeader = request.headers.get('Authorization') ?? '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (authHeader.startsWith('Handshake ')) {
    token = authHeader.slice(10);
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const expected = cfEnv.VAULT_PASSPHRASE ?? '';
    if (!expected) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE secret is not set.');
    }
    if (!token || token !== expected) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Valid sovereign passphrase required. Authenticate at /vault-gate.');
    }

    // Ensure table exists (idempotent bootstrap)
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

    const { results } = await cfEnv.DB.prepare(
      `SELECT id, event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level
       FROM sovereign_audit_logs
       ORDER BY id DESC`
    ).all<AuditStreamEntry>();

    return Response.json(
      results.map((row) => ({
        ...row,
        forensic_pulse: formatForensicPulse(row.timestamp_ns),
      }))
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, 'sovereign_audit_logs');
  }
}

/**
 * Public POST — accepts anonymous read receipts (no auth required).
 * Only the event types in ALLOWED_PUBLIC_EVENTS are accepted.
 * User-Agent is taken from the request header for reliability.
 */
const ALLOWED_PUBLIC_EVENTS = new Set(['WHITEPAPER_READ_RECEIPT', 'POW_SOLVED']);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'MALFORMED_JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || !('event_type' in body)) {
    return Response.json({ error: 'MISSING_EVENT_TYPE' }, { status: 400 });
  }

  const { event_type, timestamp_ns } = body as Record<string, unknown>;

  if (typeof event_type !== 'string' || !ALLOWED_PUBLIC_EVENTS.has(event_type)) {
    return Response.json({ error: 'UNKNOWN_EVENT_TYPE' }, { status: 400 });
  }

  // Use the real request User-Agent — more reliable than client-supplied body field
  const userAgent = (request.headers.get('User-Agent') ?? '').slice(0, 512);

  // Accept a 9-digit client microsecond timestamp if provided, otherwise fall back to server ms
  const timestampValue =
    typeof timestamp_ns === 'string' && /^\d{1,19}$/.test(timestamp_ns)
      ? timestamp_ns
      : String(Date.now());

  // Derive client IP from Cloudflare header, falling back to X-Forwarded-For
  const ipAddress =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

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
      )`,
    ).run();

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
        (event_type, ip_address, user_agent, target_path, timestamp_ns, threat_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(event_type, ipAddress, userAgent || null, '/whitepaper', timestampValue, 1)
      .run();

    return Response.json({ status: 'RECEIPT_ANCHORED' }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
