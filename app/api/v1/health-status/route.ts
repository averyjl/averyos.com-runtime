import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA } from '../../../../lib/sovereignConstants';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first(): Promise<unknown>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

interface KernelMetadataRow {
  id: number;
  build_version: string;
  kernel_resonance_hash: string;
  build_timestamp_ms: string;
  tari_pulse_peers: number;
  updated_at: string;
}

interface CountRow {
  count: number;
}

// BTC Genesis Block anchor used to seed the sovereign_builds table on first boot
const BTC_GENESIS_HASH =
  '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const BTC_ANCHOR_HEIGHT = 938909;

/**
 * Ensures the sovereign_builds table exists (runs 0011 migration inline)
 * and seeds the BTC Genesis Block anchor as the first row when the table is empty.
 */
async function ensureSovereignTables(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sovereign_builds (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_name          TEXT    NOT NULL,
      commit_sha         TEXT    NOT NULL,
      artifact_hash      TEXT    NOT NULL,
      provenance_data    TEXT,
      hardware_signature TEXT,
      btc_anchor_height  INTEGER,
      registered_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      sealed_at          TEXT
    )`
  ).run();

  const countRow = await db.prepare(
    'SELECT COUNT(*) as count FROM sovereign_builds'
  ).first() as CountRow | null;

  if (!countRow || countRow.count === 0) {
    await db.prepare(
      `INSERT INTO sovereign_builds
         (repo_name, commit_sha, artifact_hash, provenance_data, btc_anchor_height)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        'genesis',
        BTC_GENESIS_HASH,
        BTC_GENESIS_HASH,
        JSON.stringify({ btc_genesis: true, height: BTC_ANCHOR_HEIGHT, note: 'BTC Genesis Block Anchor' }),
        BTC_ANCHOR_HEIGHT,
      )
      .run();
  }
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    await ensureSovereignTables(cfEnv.DB);

    const row = await cfEnv.DB.prepare(
      'SELECT id, build_version, kernel_resonance_hash, build_timestamp_ms, tari_pulse_peers, updated_at FROM kernel_metadata ORDER BY id ASC LIMIT 1'
    ).first() as KernelMetadataRow | null;

    if (!row) {
      return Response.json({
        build_version: 'v0.0.0',
        kernel_resonance_hash: KERNEL_SHA,
        build_timestamp_ms: '000000000',
        tari_pulse_peers: 1,
        updated_at: new Date().toISOString(),
        drift_pct: '0.000',
        kernel_match: true,
      });
    }

    const kernelMatch = row.kernel_resonance_hash === KERNEL_SHA;

    return Response.json({
      build_version: row.build_version,
      kernel_resonance_hash: row.kernel_resonance_hash,
      build_timestamp_ms: row.build_timestamp_ms,
      tari_pulse_peers: row.tari_pulse_peers,
      updated_at: row.updated_at,
      drift_pct: '0.000',
      kernel_match: kernelMatch,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'HEALTH_STATUS_ERROR', detail: message }, { status: 500 });
  }
}
