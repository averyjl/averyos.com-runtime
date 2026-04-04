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
import { d1ErrorResponse } from '../../../../lib/sovereignError';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

/**
 * POST /api/v1/settlement-attempt
 * Logs a SETTLEMENT_ATTEMPT event into sovereign_audit_logs.
 * Timestamp stored with 9-digit sub-second precision (microseconds: ms * 1000, zero-padded to 9 sub-second digits).
 */
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for') ??
      'UNKNOWN';
    const ua = request.headers.get('user-agent') ?? 'UNKNOWN';

    let targetPath = '/health';
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.target_path === 'string' && body.target_path) {
        targetPath = body.target_path.slice(0, 256);
      }
    } catch {
      // use default target_path
    }

    // Timestamp with 9-digit sub-second precision: ms since epoch + 6 zero-padded sub-ms digits
    const nowMs = Date.now();
    const timestampNs = String(nowMs) + '000000';

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
        threat_level INTEGER DEFAULT 1
      )`
    ).run();

    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('SETTLEMENT_ATTEMPT', ip, ua, null, targetPath, timestampNs, 5)
      .run();

    return Response.json({
      success: true,
      event: 'SETTLEMENT_ATTEMPT',
      timestamp_ns: timestampNs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, 'sovereign_audit_logs');
  }
}
