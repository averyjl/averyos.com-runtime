import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { VaultChainTransaction } from '../route';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ txId: string }> }
) {
  const { txId } = await params;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const row = await cfEnv.DB.prepare(
      `SELECT id, transaction_id, timestamp, event_type, private_capsule_sha512, target, details, created_at
       FROM vaultchain_transactions
       WHERE transaction_id = ?
       LIMIT 1`
    )
      .bind(txId)
      .first<VaultChainTransaction>();

    if (!row) {
      return Response.json({ error: 'NOT_FOUND', detail: `Transaction ${txId} not found.` }, { status: 404 });
    }

    return Response.json({ transaction: row });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'LEDGER_ERROR', detail: message }, { status: 500 });
  }
}
