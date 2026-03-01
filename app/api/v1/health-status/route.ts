import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA } from '../../../../lib/sovereignConstants';

interface D1Database {
  prepare(query: string): {
    first(): Promise<unknown>;
  };
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
