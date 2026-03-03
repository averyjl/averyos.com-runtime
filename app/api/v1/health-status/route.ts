import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA } from '../../../../lib/sovereignConstants';

const GENESIS_BTC_HEIGHT = 938909;
const GENESIS_REPO = 'averyjl/averyos.com-runtime';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

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

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS vaultchain_transactions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id   TEXT    NOT NULL UNIQUE,
      timestamp        TEXT    NOT NULL,
      event_type       TEXT    NOT NULL,
      private_capsule_sha512 TEXT NOT NULL,
      target           TEXT    NOT NULL DEFAULT '',
      details          TEXT    NOT NULL DEFAULT '',
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  // Seed genesis row if table is empty
  const existing = await db.prepare('SELECT id FROM sovereign_builds LIMIT 1').first<{ id: number }>();
  if (!existing) {
    await db.prepare(
      `INSERT INTO sovereign_builds (repo_name, commit_sha, artifact_hash, btc_anchor_height, registered_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      GENESIS_REPO,
      KERNEL_SHA,
      KERNEL_SHA,
      GENESIS_BTC_HEIGHT,
      new Date().toISOString()
    ).run();
  }
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
