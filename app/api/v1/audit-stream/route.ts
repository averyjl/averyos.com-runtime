import { getCloudflareContext } from '@opennextjs/cloudflare';
import { formatIso9 } from '../../../../lib/timePrecision';

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
  // YubiKey Hardware Handshake: require Authorization: Bearer <VAULT_PASSPHRASE>
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const expected = cfEnv.VAULT_PASSPHRASE ?? '';
    if (!expected) {
      return Response.json(
        { error: 'VAULT_NOT_CONFIGURED', detail: 'VAULT_PASSPHRASE secret is not set.' },
        { status: 503 }
      );
    }
    if (!token || token !== expected) {
      return Response.json(
        { error: 'YUBIKEY_HANDSHAKE_REQUIRED', detail: 'Valid sovereign passphrase required.' },
        { status: 401 }
      );
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
       WHERE threat_level >= 5
       ORDER BY id DESC
       LIMIT 10`
    ).all<AuditStreamEntry>();

    return Response.json(
      results.map((row) => ({
        ...row,
        forensic_pulse: formatForensicPulse(row.timestamp_ns),
      }))
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'AUDIT_STREAM_ERROR', detail: message }, { status: 500 });
  }
}
