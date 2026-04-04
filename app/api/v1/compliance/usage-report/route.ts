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
import { KERNEL_SHA } from '../../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

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

interface EventTypeBreakdownRow {
  event_type: string;
  count: number;
}

/**
 * GET /api/v1/compliance/usage-report
 * Returns a Technical Usage Report for the requesting IP's /24 subnet.
 * Counts interactions in sovereign_audit_logs, returns pulse timestamps,
 * and provides an event-type breakdown for enterprise transparency.
 * Phase 78.5: expanded with per-event-type aggregation.
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

    // Per-event-type breakdown for this IP range
    const { results: breakdownRows } = await cfEnv.DB.prepare(
      `SELECT event_type, COUNT(*) AS count
       FROM sovereign_audit_logs
       WHERE ip_address LIKE ?
       GROUP BY event_type
       ORDER BY count DESC`
    )
      .bind(ipRange)
      .all<EventTypeBreakdownRow>();

    const sha512Pulses: string[] = pulseRows.map((row) => row.timestamp_ns);
    const eventTypeBreakdown: Record<string, number> = {};
    for (const row of breakdownRows) {
      eventTypeBreakdown[row.event_type] = row.count;
    }

    const displayRange = octets.length === 4
      ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
      : ip;

    return Response.json({
      report_type: 'TECHNICAL_USAGE_REPORT',
      ip_range: displayRange,
      interaction_count: interactionCount,
      event_type_breakdown: eventTypeBreakdown,
      sha512_pulses: sha512Pulses,
      kernel_anchor: KERNEL_SHA,
      generated_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
