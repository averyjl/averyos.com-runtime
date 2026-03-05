import { getCloudflareContext } from '@opennextjs/cloudflare';
import { aosErrorResponse, AOS_ERROR } from '../../../../lib/sovereignError';

interface D1Database {
  prepare(query: string): {
    bind(...args: unknown[]): { first(): Promise<unknown> };
    first(): Promise<unknown>;
  };
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
}

interface CloudflareEnv {
  DB: D1Database;
  AVERY_KV: KVNamespace;
}

interface VaultLedgerRow {
  id: number;
  sha512_hash: string;
  anchor_label: string | null;
  btc_block_height: number | null;
  btc_block_hash: string | null;
  created_at: string;
}

const ROOT0_ANCHOR =
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KV_GENESIS_KEY = 'current_genesis_state';

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Parallel: vault_ledger latest row + KV genesis state
    const [row, kvRaw] = await Promise.all([
      cfEnv.DB.prepare(
        'SELECT id, sha512_hash, anchor_label, btc_block_height, btc_block_hash, created_at FROM vault_ledger ORDER BY id DESC LIMIT 1'
      ).first() as Promise<VaultLedgerRow | null>,
      cfEnv.AVERY_KV.get(KV_GENESIS_KEY),
    ]);

    const vaultSha = row?.sha512_hash?.trim().toLowerCase() ?? null;
    const kvState  = (kvRaw ?? ROOT0_ANCHOR).trim().toLowerCase();

    // CreatorLock is ACTIVE when KV genesis state matches the latest vault_ledger SHA
    const driftDetected = vaultSha !== null && vaultSha !== kvState;
    const creatorLock   = driftDetected ? 'VIOLATED' : 'ACTIVE';

    return Response.json({
      creator_lock:              creatorLock,
      drift_detected:            driftDetected,
      vault_ledger_sha:          vaultSha,
      vault_ledger_anchor_label: row?.anchor_label ?? null,
      vault_ledger_created_at:   row?.created_at ?? null,
      stored_btc_block_height:   row?.btc_block_height ?? null,
      stored_btc_block_hash:     row?.btc_block_hash ?? null,
      kv_genesis_state:          kvState,
      root0_anchor:              ROOT0_ANCHOR,
      kernel_anchor_verified:    vaultSha === ROOT0_ANCHOR.toLowerCase(),
      queried_at:                new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
