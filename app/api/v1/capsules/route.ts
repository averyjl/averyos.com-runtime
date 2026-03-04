import { getCloudflareContext } from "@opennextjs/cloudflare";

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
    return Response.json({ error: "CAPSULES_LIST_ERROR", detail: message }, { status: 500 });
  }
}
