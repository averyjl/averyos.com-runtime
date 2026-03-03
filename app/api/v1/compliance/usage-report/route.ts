import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA } from '../../../../../lib/sovereignConstants';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

interface UsageRow {
  interaction_count: number;
}

interface PulseRow {
  timestamp_ns: string;
}

/**
 * GET /api/v1/compliance/usage-report
 * Returns a Technical Usage Report for the requesting IP's /24 subnet.
 * Counts interactions in sovereign_audit_logs and returns associated SHA-512 pulses.
 * Standard audit requirement for enterprise transparency.
 */
export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for') ??
      'UNKNOWN';

    // Derive /24 subnet prefix for range-based counting
    const octets = ip.split('.');
    const ipRange =
      octets.length === 4
        ? `${octets[0]}.${octets[1]}.${octets[2]}.%`
        : `${ip}%`;

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

    // COUNT interactions for the IP range
    const countRow = await cfEnv.DB.prepare(
      `SELECT COUNT(*) AS interaction_count
       FROM sovereign_audit_logs
       WHERE ip_address LIKE ?`
    )
      .bind(ipRange)
      .first<UsageRow>();

    const interactionCount = countRow?.interaction_count ?? 0;

    // Retrieve the most recent SHA-512 pulse timestamps for the range (up to 10)
    const { results: pulseRows } = await cfEnv.DB.prepare(
      `SELECT timestamp_ns
       FROM sovereign_audit_logs
       WHERE ip_address LIKE ?
       ORDER BY id DESC
       LIMIT 10`
    )
      .bind(ipRange)
      .all<PulseRow>();

    const sha512Pulses: string[] = pulseRows.map((row) => row.timestamp_ns);

    const displayRange = octets.length === 4
      ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
      : ip;

    return Response.json({
      report_type: 'TECHNICAL_USAGE_REPORT',
      ip_range: displayRange,
      interaction_count: interactionCount,
      sha512_pulses: sha512Pulses,
      kernel_anchor: KERNEL_SHA,
      generated_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'USAGE_REPORT_ERROR', detail: message },
      { status: 500 }
    );
  }
}
