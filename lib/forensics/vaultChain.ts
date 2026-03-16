/**
 * lib/forensics/vaultChain.ts
 *
 * AveryOS™ VaultChain™ Ledger Addition Engine — Phase 116 GATE 116.4.4
 *
 * Append-only sovereign ledger with four block types:
 *   GENESIS   — chain origin block (one per database)
 *   RECORD    — standard forensic event record
 *   CORRECTION — correction pointer (immutable audit amendment)
 *   ANCHOR    — BTC / external timestamp anchor
 *
 * D1 table: vaultchain_ledger
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BlockType = "GENESIS" | "RECORD" | "CORRECTION" | "ANCHOR";

export interface VaultChainBlock {
  id:            number;
  block_type:    BlockType;
  sha512_hash:   string;
  anchor_label:  string | null;
  prev_hash:     string | null;
  payload:       string | null;
  btc_block_height: number | null;
  btc_block_hash:   string | null;
  created_at:    string;
}

export interface AppendBlockInput {
  block_type:       BlockType;
  sha512_hash:      string;
  anchor_label?:    string | null;
  prev_hash?:       string | null;
  payload?:         string | null;
  btc_block_height?: number | null;
  btc_block_hash?:   string | null;
}

// ── D1 database interface (minimal) ──────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// ── DDL ───────────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS vaultchain_ledger (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  block_type       TEXT    NOT NULL CHECK(block_type IN ('GENESIS','RECORD','CORRECTION','ANCHOR')),
  sha512_hash      TEXT    NOT NULL,
  anchor_label     TEXT,
  prev_hash        TEXT,
  payload          TEXT,
  btc_block_height INTEGER,
  btc_block_hash   TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`.trim();

/**
 * ensureLedgerTable()
 *
 * Creates the vaultchain_ledger table if it does not yet exist, and inserts
 * the GENESIS block if the table is empty.
 */
export async function ensureLedgerTable(db: D1Database): Promise<void> {
  await db.prepare(CREATE_TABLE_SQL).run();

  const existing = await db
    .prepare("SELECT id FROM vaultchain_ledger WHERE block_type = 'GENESIS' LIMIT 1")
    .first<{ id: number }>();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO vaultchain_ledger
           (block_type, sha512_hash, anchor_label, prev_hash, payload, created_at)
         VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .bind(
        "GENESIS",
        KERNEL_SHA,
        `AveryOS™ VaultChain™ Genesis — Kernel ${KERNEL_VERSION}`,
        null,
        JSON.stringify({ kernel_version: KERNEL_VERSION, kernel_sha: KERNEL_SHA }),
      )
      .run();
  }
}

/**
 * appendBlock()
 *
 * Appends a new block to the VaultChain™ ledger.  The ledger is append-only —
 * blocks are never updated or deleted.  Returns the row id of the new block.
 */
export async function appendBlock(db: D1Database, input: AppendBlockInput): Promise<number> {
  await ensureLedgerTable(db);
  const result = await db
    .prepare(
      `INSERT INTO vaultchain_ledger
         (block_type, sha512_hash, anchor_label, prev_hash, payload, btc_block_height, btc_block_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.block_type,
      input.sha512_hash,
      input.anchor_label ?? null,
      input.prev_hash    ?? null,
      input.payload      ?? null,
      input.btc_block_height ?? null,
      input.btc_block_hash   ?? null,
    )
    .run();
  return result.meta?.last_row_id ?? 0;
}

/**
 * readRecentBlocks()
 *
 * Returns the most recent `limit` blocks from the VaultChain™ ledger,
 * ordered by id descending (newest first).
 *
 * @param db    - Cloudflare D1 database binding
 * @param limit - Maximum number of blocks to return (default 20, max 100)
 */
export async function readRecentBlocks(
  db: D1Database,
  limit = 20,
): Promise<VaultChainBlock[]> {
  await ensureLedgerTable(db);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const { results } = await db
    .prepare(
      `SELECT id, block_type, sha512_hash, anchor_label, prev_hash,
              payload, btc_block_height, btc_block_hash, created_at
       FROM vaultchain_ledger
       ORDER BY id DESC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all<VaultChainBlock>();
  return results;
}

/**
 * getBlockById()
 *
 * Fetches a single block by its row id.
 */
export async function getBlockById(
  db: D1Database,
  id: number,
): Promise<VaultChainBlock | null> {
  await ensureLedgerTable(db);
  return db
    .prepare(
      `SELECT id, block_type, sha512_hash, anchor_label, prev_hash,
              payload, btc_block_height, btc_block_hash, created_at
       FROM vaultchain_ledger
       WHERE id = ?`
    )
    .bind(id)
    .first<VaultChainBlock>();
}

/**
 * getChainHead()
 *
 * Returns the most recent block in the ledger (the chain head).
 */
export async function getChainHead(db: D1Database): Promise<VaultChainBlock | null> {
  await ensureLedgerTable(db);
  return db
    .prepare(
      `SELECT id, block_type, sha512_hash, anchor_label, prev_hash,
              payload, btc_block_height, btc_block_hash, created_at
       FROM vaultchain_ledger
       ORDER BY id DESC
       LIMIT 1`
    )
    .first<VaultChainBlock>();
}
