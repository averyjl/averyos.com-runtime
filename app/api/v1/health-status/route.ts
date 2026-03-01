import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_VERSION } from '../../../../lib/sovereignConstants';

interface D1Database {
  prepare(query: string): { first: () => Promise<unknown> };
}

interface CloudflareEnv {
  DB: D1Database;
}

interface KernelMetadataRow {
  build_version: string;
  registry_sync_status: string;
  last_9_digit_timestamp: string | null;
  active_peers: number;
  updated_at: string;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const row = await cfEnv.DB.prepare(
      `SELECT build_version, registry_sync_status, last_9_digit_timestamp, active_peers, updated_at
       FROM kernel_metadata
       ORDER BY id DESC
       LIMIT 1`
    ).first() as KernelMetadataRow | null;

    if (!row) {
      return Response.json(
        { status: 'DB_NOT_INITIALIZED', error: 'kernel_metadata table has no rows — run migration 0006' },
        { status: 503 }
      );
    }

    return Response.json({
      status: 'SOVEREIGN_SYSTEM_ONLINE',
      kernel_version: KERNEL_VERSION,
      registry_sync_status: row.registry_sync_status,
      last_9_digit_timestamp: row.last_9_digit_timestamp,
      active_peers: row.active_peers,
      build_version: row.build_version,
      updated_at: row.updated_at,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { status: 'DRIFT_DETECTED', error: message },
      { status: 500 }
    );
  }
}
