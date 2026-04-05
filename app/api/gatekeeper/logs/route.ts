/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { TOP_FORENSIC_LOG_HASHES } from "../../../../lib/forensicHashes";
import { formatIso9 } from "../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

interface D1PreparedStatement {
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

type AuditLogRow = {
  id: number;
  entity: string;
  ip: string;
  status: string;
  timestamp: string;
};

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        ip TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now', 'localtime'))
      )`
    ).run();

    const { results } = await cfEnv.DB.prepare(
      `SELECT id, entity, ip, status, timestamp
       FROM audit_logs
       ORDER BY id DESC
       LIMIT 50`
    ).all<AuditLogRow>();

    return Response.json(
      results.map((row, index) => ({
        id: row.id,
        entity: row.entity,
        ip: row.ip,
        status: row.status,
        timestamp: formatIso9(row.timestamp),
        log_hash: TOP_FORENSIC_LOG_HASHES[index % TOP_FORENSIC_LOG_HASHES.length],
      })),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, `AUDIT_LOG_FETCH_ERROR: ${message}`);
  }
}
