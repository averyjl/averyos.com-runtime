/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
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
  tari_liability_usd?: number | null;
}

/** Public SSE event shape — strips PII (no ip_address). */
interface SseAuditEvent {
  id: number;
  event_type: string;
  threat_level: number | null;
  tari_liability_usd: number | null;
  timestamp_ns: string;
  forensic_pulse: string;
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

// ── SSE constants ──────────────────────────────────────────────────────────────
/** How long to wait between D1 polls in the SSE stream (ms). */
const SSE_POLL_INTERVAL_MS = 5_000;
/** Number of poll iterations before closing the SSE connection (~25 s total). */
const SSE_POLL_COUNT = 4;

/**
 * Query recent audit events from D1 since a given id (exclusive).
 * Returns up to `limit` rows ordered by id ASC (oldest first so SSE consumers
 * receive events in chronological order).
 */
async function queryEventsSinceId(
  db: D1Database,
  sinceId: number,
  limit = 50
): Promise<SseAuditEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT id, event_type, threat_level, tari_liability_usd, timestamp_ns
       FROM sovereign_audit_logs
       WHERE id > ?
       ORDER BY id ASC
       LIMIT ?`
    )
    .bind(sinceId, limit)
    .all<AuditStreamEntry>();

  return results.map((row) => ({
    id:                 row.id,
    event_type:         row.event_type,
    threat_level:       row.threat_level ?? null,
    tari_liability_usd: row.tari_liability_usd ?? null,
    timestamp_ns:       row.timestamp_ns,
    forensic_pulse:     formatForensicPulse(row.timestamp_ns),
  }));
}

export async function GET(request: Request) {
  const acceptHeader = request.headers.get('Accept') ?? '';
  const wantsSSE = acceptHeader.includes('text/event-stream');

  // ── SSE branch — EventSource (tari-revenue dashboard) ────────────────────
  // No auth required for the SSE stream; PII (ip_address) is not included.
  // Polls D1 every 5 seconds for new events and emits them as SSE data.
  // Connection closes after ~25 seconds; EventSource auto-reconnects.
  if (wantsSSE) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const cfEnv = env as unknown as CloudflareEnv;

      // Ensure table exists (idempotent)
      await cfEnv.DB.prepare(
        `CREATE TABLE IF NOT EXISTS sovereign_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          user_agent TEXT,
          geo_location TEXT,
          target_path TEXT NOT NULL,
          timestamp_ns TEXT NOT NULL,
          threat_level INTEGER DEFAULT 1,
          tari_liability_usd REAL,
          pulse_hash TEXT
        )`
      ).run();

      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();

      const writeEvent = async (event: SseAuditEvent) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const writeKeepAlive = async () => {
        await writer.write(encoder.encode(': keepalive\n\n'));
      };

      // Async stream pump — send recent events then poll for new ones
      (async () => {
        try {
          // Bootstrap: send the 50 most recent rows immediately
          const { results: seed } = await cfEnv.DB
            .prepare(
              `SELECT id, event_type, threat_level, tari_liability_usd, timestamp_ns
               FROM sovereign_audit_logs
               ORDER BY id DESC
               LIMIT 50`
            )
            .all<AuditStreamEntry>();

          // Reverse so events are in chronological order
          const seedEvents: SseAuditEvent[] = seed
            .reverse()
            .map((row) => ({
              id:                 row.id,
              event_type:         row.event_type,
              threat_level:       row.threat_level ?? null,
              tari_liability_usd: row.tari_liability_usd ?? null,
              timestamp_ns:       row.timestamp_ns,
              forensic_pulse:     formatForensicPulse(row.timestamp_ns),
            }));

          for (const evt of seedEvents) {
            await writeEvent(evt);
          }

          let lastId = seedEvents.length > 0 ? seedEvents[seedEvents.length - 1].id : 0;

          // Poll for new events SSE_POLL_COUNT × SSE_POLL_INTERVAL_MS, then close
          for (let i = 0; i < SSE_POLL_COUNT; i++) {
            await new Promise<void>((resolve) => setTimeout(resolve, SSE_POLL_INTERVAL_MS));
            const newEvents = await queryEventsSinceId(cfEnv.DB, lastId);
            for (const evt of newEvents) {
              await writeEvent(evt);
              lastId = evt.id;
            }
            await writeKeepAlive();
          }
        } catch (err) {
          console.warn(`[audit-stream] SSE pump error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          try { await writer.close(); } catch { /* already closed */ }
        }
      })();

      return new Response(readable, {
        status: 200,
        headers: {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache, no-store',
          'Connection':    'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return d1ErrorResponse(message, 'sovereign_audit_logs');
    }
  }

  // ── Standard JSON branch (authenticated) ─────────────────────────────────
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
