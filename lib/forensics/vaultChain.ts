/**
 * lib/forensics/vaultChain.ts
 *
 * AveryOS™ VaultChain™ Ledger Addition Engine — GATE 119.9.4
 *
 * Append-only sovereign ledger backed by D1 table `vaultchain_ledger`.
 *
 * Block types:
 *   GENESIS    — initial anchor block (one per chain)
 *   RECORD     — standard sovereign event record
 *   CORRECTION — approved amendment to a prior block
 *   ANCHOR     — periodic SHA-512 checkpoint block
 *
 * All writes are append-only; no UPDATE or DELETE is ever issued.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Block types ────────────────────────────────────────────────────────────────

export type BlockType = "GENESIS" | "RECORD" | "CORRECTION" | "ANCHOR";

export interface VaultBlock {
  id:            number;
  block_type:    BlockType;
  timestamp:     string;
  block_sha512:  string;
  payload:       string;
  ref_block_id:  number | null;
  kernel_version: string;
  kernel_sha:    string;
  author:        string | null;
}

// ── Minimal D1 types ──────────────────────────────────────────────────────────

interface D1Statement {
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
  bind(...values: unknown[]): D1Statement;
}

export interface VaultChainDB {
  prepare(query: string): D1Statement;
}

// ── SHA-512 helper ─────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const buf  = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest("SHA-512", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("crypto");
  return createHash("sha512").update(input, "utf8").digest("hex");
}

// ── DDL guard ─────────────────────────────────────────────────────────────────

export async function ensureVaultChainTable(db: VaultChainDB): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS vaultchain_ledger (
       id             INTEGER PRIMARY KEY AUTOINCREMENT,
       block_type     TEXT    NOT NULL DEFAULT 'RECORD',
       timestamp      TEXT    NOT NULL,
       block_sha512   TEXT    NOT NULL,
       payload        TEXT    NOT NULL,
       ref_block_id   INTEGER,
       kernel_version TEXT    NOT NULL,
       kernel_sha     TEXT    NOT NULL,
       author         TEXT
     )`
  ).run();
}

// ── Read API ──────────────────────────────────────────────────────────────────

/**
 * Read the most recent blocks from the ledger, newest first.
 *
 * @param db     D1 database binding.
 * @param limit  Maximum number of blocks (default 20, max 100).
 */
export async function readRecentBlocks(
  db: VaultChainDB,
  limit = 20
): Promise<VaultBlock[]> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  try {
    await ensureVaultChainTable(db);
    const { results } = await db.prepare(
      `SELECT id, block_type, timestamp, block_sha512, payload,
              ref_block_id, kernel_version, kernel_sha, author
       FROM vaultchain_ledger
       ORDER BY id DESC
       LIMIT ?`
    ).bind(safeLimit).all<VaultBlock>();
    return results;
  } catch {
    return [];
  }
}

/**
 * Count total blocks in the ledger.
 */
export async function countBlocks(db: VaultChainDB): Promise<number> {
  try {
    await ensureVaultChainTable(db);
    const row = await db.prepare(
      `SELECT COUNT(*) AS total FROM vaultchain_ledger`
    ).first<{ total: number }>();
    return row?.total ?? 0;
  } catch {
    return 0;
  }
}

// ── Write API ─────────────────────────────────────────────────────────────────

export interface WriteBlockInput {
  block_type?:   BlockType;
  payload:       string;
  ref_block_id?: number | null;
  author?:       string | null;
}

/**
 * Append a new block to the VaultChain™ ledger.
 * Returns the new block's row id, or null on failure.
 */
export async function writeBlock(
  db: VaultChainDB,
  input: WriteBlockInput
): Promise<number | null> {
  const blockType  = input.block_type ?? "RECORD";
  const timestamp  = formatIso9(new Date());
  const refBlockId = input.ref_block_id ?? null;
  const author     = input.author ?? "ROOT0";

  const contentForHash = JSON.stringify({
    block_type: blockType, timestamp,
    payload: input.payload, ref_block_id: refBlockId,
    kernel_version: KERNEL_VERSION, kernel_sha: KERNEL_SHA, author,
  });
  const blockSha512 = await sha512hex(contentForHash);

  try {
    await ensureVaultChainTable(db);
    const result = await db.prepare(
      `INSERT INTO vaultchain_ledger
         (block_type, timestamp, block_sha512, payload, ref_block_id, kernel_version, kernel_sha, author)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(blockType, timestamp, blockSha512, input.payload,
           refBlockId, KERNEL_VERSION, KERNEL_SHA, author).run();
    return result.meta?.last_row_id ?? null;
  } catch {
    return null;
  }
}
