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
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

interface D1Row {
  capsule_id: string;
  title: string;
  description: string | null;
  sha512: string;
  genesis_date: string;
  tari_fee_usd: number;
  status: string;
  uploaded_at: string;
}

interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): { all: () => Promise<{ results: D1Row[] }> };
    all: () => Promise<{ results: D1Row[] }>;
  };
}

interface CloudflareEnv {
  DB: D1Database;
}

/**
 * GET /api/v1/capsules
 * Returns the public marketplace listing of all ACTIVE capsules.
 * Only exposes fields safe for unauthenticated access — file keys are omitted.
 */
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_capsules (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        capsule_id      TEXT    NOT NULL UNIQUE,
        title           TEXT    NOT NULL,
        description     TEXT,
        sha512          TEXT    NOT NULL,
        genesis_date    TEXT    NOT NULL,
        tari_fee_usd    REAL    NOT NULL DEFAULT 1.00,
        file_key        TEXT,
        status          TEXT    NOT NULL DEFAULT 'ACTIVE',
        uploaded_at     TEXT    NOT NULL,
        uploaded_by     TEXT    NOT NULL DEFAULT 'SOVEREIGN_ADMIN'
      )`
    ).all();

    const { results } = await cfEnv.DB.prepare(
      `SELECT capsule_id, title, description, sha512, genesis_date, tari_fee_usd, status, uploaded_at
       FROM sovereign_capsules
       WHERE status = 'ACTIVE'
       ORDER BY uploaded_at DESC`
    ).all();

    return Response.json({ capsules: results, count: results.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
