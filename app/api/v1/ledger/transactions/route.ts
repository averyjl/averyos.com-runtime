import { getCloudflareContext } from '@opennextjs/cloudflare';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
}

export interface VaultChainTransaction {
  id: number;
  transaction_id: string;
  timestamp: string;
  event_type: string;
  private_capsule_sha512: string;
  target: string;
  details: string;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const url = new URL(request.url);
    const sinceId = url.searchParams.get('since');

    let query: string;
    let stmt: ReturnType<D1Database['prepare']>;

    if (sinceId) {
      query = `SELECT id, transaction_id, timestamp, event_type, private_capsule_sha512, target, details, created_at
               FROM vaultchain_transactions
               WHERE id > ?
               ORDER BY id DESC
               LIMIT 100`;
      stmt = cfEnv.DB.prepare(query).bind(Number(sinceId));
    } else {
      query = `SELECT id, transaction_id, timestamp, event_type, private_capsule_sha512, target, details, created_at
               FROM vaultchain_transactions
               ORDER BY id DESC
               LIMIT 100`;
      stmt = cfEnv.DB.prepare(query);
    }

    const { results } = await stmt.all<VaultChainTransaction>();

    return Response.json({ transactions: results, count: results.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'LEDGER_ERROR', detail: message }, { status: 500 });
  }
}
