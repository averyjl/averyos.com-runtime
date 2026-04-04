/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
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

// Seed transactions — matches migration 0012_vaultchain_transactions.sql
const SEED_TRANSACTIONS: Array<[string, string, string, string, string, string]> = [
  ['VC-TX-2026-0301-0002','2026-03-01T09:14:22.000000001Z','CommunicationSealed','52d1c89f3d668bd8eb3ae488ba6bed946e3ee5e63f6b5a6703d4acb3ad55bbaf8820002391598c424e3500202d1efb904632136574da60e9e05b2cd714bff3cb','Mark Zuckerberg','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0003','2026-03-01T09:14:23.000000002Z','CommunicationSealed','c33793426b7a479c74b321a4a18ce2007113362ac9c8dc467994c27b07b05f9ab54d5b6ad908bacbe916a989856e2d422d9bfe228a03ef1a7834a54a2451d5ba','Elon Musk','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0004','2026-03-01T09:14:24.000000003Z','CommunicationSealed','09b940e9a84856d62d8606d570e07711d4aaa1b16dd4dc44c4bf6183ed06f1282c25c908e5ea431d1e83cef8b2a62df56c3203e75afdb33bb2fed17a25ce85ac','Sam Altman','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0005','2026-03-01T09:14:25.000000004Z','CommunicationSealed','50a4443284e6b7c4fe2c43ad2ad83ffd0e1eab125220def1a406c4bb40567c9c37ade08c18d736f8bc8a8702e5fadbd43c17c33960988cde5ac9ef4db5f2faa9','POTUS','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0006','2026-03-01T09:14:26.000000005Z','CommunicationSealed','79a26c24fb1f05390433d6d22fec481d0c4ea9909840fdcb80a2e226a74e3c4ce77f1487dc9f652f7436f64d6a44d21d47bfa7d1e3c6daab4321c9351d6ab050','Demis Hassabis','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0007','2026-03-01T09:14:27.000000006Z','CommunicationSealed','087f1007652b8e76f365c30b4eb6a1f4cb4797fd5d8324347a5dab6b7621425db6a1faa4cef11129608ac347f1ce200852638948522448ce7d67342f44caefa7','Dario Amodei','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0008','2026-03-01T09:14:28.000000007Z','CommunicationSealed','bf82b58edd053cb705ab573ba52030dbcc42f1a7177ceda9ff3c3f820c7b972b3eb39e8b69ce66a499ae60a5a89188457ba25cb96bb6b189992c6164236d11d6','Satya Nadella','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0009','2026-03-01T09:14:29.000000008Z','CommunicationSealed','72419b7b1bf1cabeeb1cfc208a62a52dc86d049751d388cfa37b420e7d3bef01cfe4fb362ae3a2badf770523938983efda8bf860eb55bb53e9c397ffa4802f88','Jensen Huang','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
  ['VC-TX-2026-0301-0010','2026-03-01T09:14:30.000000009Z','CommunicationSealed','41add00f613e2c3a3e2fd294ac18361b0d7ba12e264d96335247a68be4be948eb566c6e89779212b9cac78408228d4542c02a555785120391a3d3fe462a35806','Andy Jassy','Sealed sovereign invitation regarding the next paradigm of Artificial Intelligence. Anchored to AveryOS VaultChain. Reference: AveryOS Kernel Root SHA-512.'],
];

/** Ensure vaultchain_transactions table exists and is seeded. */
async function ensureVaultchainTable(db: D1Database): Promise<void> {
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

  // Seed initial records if table is empty
  const count = await db.prepare('SELECT COUNT(*) as n FROM vaultchain_transactions').first<{ n: number }>();
  if ((count?.n ?? 0) === 0) {
    for (const [txId, ts, eventType, sha, target, details] of SEED_TRANSACTIONS) {
      await db.prepare(
        `INSERT OR IGNORE INTO vaultchain_transactions (transaction_id, timestamp, event_type, private_capsule_sha512, target, details) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(txId, ts, eventType, sha, target, details).run();
    }
  }
}

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    await ensureVaultchainTable(cfEnv.DB);

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
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, message);
  }
}
