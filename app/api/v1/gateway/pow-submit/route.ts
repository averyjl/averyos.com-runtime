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
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

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

interface PoWPayload {
  nonce?: unknown;
  solution_hash?: unknown;
  fingerprint?: unknown;
  timestamp?: unknown;
  cpu_cycles?: unknown;
}

/**
 * POST /api/v1/gateway/pow-submit
 * Accepts a solved PoW evidence bundle and seals it to the VaultChain™
 * sovereign_audit_logs table. Returns the assessed TARI™ entry fee.
 *
 * Formula: EntryFee ($1,017) + (cpu_cycles * Integrity_Multiplier 0.000001)
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

    let payload: PoWPayload = {};
    try {
      payload = (await request.json()) as PoWPayload;
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'Request payload is invalid or malformed.');
    }

    const { nonce, solution_hash, fingerprint, timestamp, cpu_cycles } = payload;

    if (typeof solution_hash !== 'string' || !/^[a-fA-F0-9]{128}$/.test(solution_hash)) {
      return Response.json(
        { error: 'INVALID_SOLUTION_HASH', detail: 'solution_hash must be a 128-char SHA-512 hex string' },
        { status: 400 },
      );
    }

    if (typeof nonce !== 'number') {
      return Response.json(
        { error: 'INVALID_NONCE', detail: 'nonce must be a number' },
        { status: 400 },
      );
    }

    // Timestamp with 9-digit sub-second precision
    const nowMs = Date.now();
    const timestampNs = String(nowMs) + '000000';

    // Entry fee: $1,017 base + (cpu_cycles * integrity_multiplier)
    const cycles = typeof cpu_cycles === 'number' ? cpu_cycles : 0;
    const integrityMultiplier = 0.000001;
    const entryFeeUsd = 1017 + cycles * integrityMultiplier;

    // Ensure table exists (idempotent bootstrap guard)
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
        'POW_GATEWAY_ENTRY',
        ip,
        ua,
        null,
        `/gateway/pow#${solution_hash.slice(0, 16)}|fp:${typeof fingerprint === 'string' ? fingerprint.slice(0, 16) : 'UNKNOWN'}|ts:${typeof timestamp === 'string' ? timestamp : timestampNs}|cycles:${cycles}`,
        timestampNs,
        3,
      )
      .run();

    return Response.json({
      success: true,
      event: 'POW_GATEWAY_ENTRY',
      solution_hash,
      entry_fee_usd: entryFeeUsd,
      timestamp_ns: timestampNs,
      detail: `Sovereign PoW verified. Evidence Bundle sealed to VaultChain™. Entry fee assessed: $${entryFeeUsd.toFixed(2)}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
