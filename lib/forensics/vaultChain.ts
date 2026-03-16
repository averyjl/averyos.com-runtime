/**
 * lib/forensics/vaultChain.ts
 *
 * AveryOS™ VaultChain™ Versioning — Ledger Addition Engine
 * Phase 119.7 GATE 119.7.4
 *
 * Implements the "Ledger Addition" principle:
 *   • History is immutable — existing records are never modified or deleted.
 *   • Corrections are appended as new "Correction" blocks that reference
 *     the original record's ID and hash.
 *   • Every block in the chain is SHA-512 hashed and linked to the previous
 *     block hash, creating a tamper-evident append-only forensic ledger.
 *
 * The "Never Modified" rule (Jason Lee Avery, ROOT0):
 *   "Nothing should be changed... we never change history we just correct
 *   it later on down the Ledger line."
 *
 * Block types:
 *   GENESIS       — First block; anchors the chain to the KERNEL_SHA.
 *   RECORD        — Standard forensic event record.
 *   CORRECTION    — References and supersedes a prior RECORD block.
 *   ANCHOR        — Periodic SHA-512 checkpoint (e.g. per BTC block).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── Block type catalogue ───────────────────────────────────────────────────────

export type VaultChainBlockType =
  | "GENESIS"
  | "RECORD"
  | "CORRECTION"
  | "ANCHOR";

// ── Block interfaces ───────────────────────────────────────────────────────────

/** Base fields present on every VaultChain™ block. */
export interface VaultChainBlockBase {
  /** Unique monotonic block ID (auto-incremented by the ledger). */
  id:             number;
  /** Block type. */
  type:           VaultChainBlockType;
  /** ISO-9 timestamp of block creation. */
  created_at:     string;
  /** SHA-512 hash of this block's canonical payload. */
  block_sha512:   string;
  /** SHA-512 hash of the immediately preceding block (null for GENESIS). */
  prev_sha512:    string | null;
  /** Kernel version at time of block creation. */
  kernel_version: string;
}

/** A standard forensic event record. */
export interface VaultChainRecord extends VaultChainBlockBase {
  type:        "RECORD";
  /** Arbitrary event label (e.g. 'BOT_HIT', 'TARI_INVOICE'). */
  event:       string;
  /** Serialised JSON payload of the event. */
  payload:     string;
}

/** A correction block that supersedes a prior record. */
export interface VaultChainCorrection extends VaultChainBlockBase {
  type:              "CORRECTION";
  /** ID of the original RECORD block being corrected. */
  corrects_id:       number;
  /** SHA-512 hash of the original block being corrected. */
  corrects_sha512:   string;
  /** Human-readable reason for the correction. */
  reason:            string;
  /** Corrected event payload (serialised JSON). */
  corrected_payload: string;
}

/** A periodic SHA-512 anchor checkpoint. */
export interface VaultChainAnchor extends VaultChainBlockBase {
  type:         "ANCHOR";
  /** Running SHA-512 of the entire chain up to this block. */
  chain_sha512: string;
  /** Optional: Bitcoin block height at anchor time. */
  btc_height?:  number;
  /** Optional: Bitcoin block hash at anchor time. */
  btc_hash?:    string;
}

/** The genesis block (first block in the chain). */
export interface VaultChainGenesis extends VaultChainBlockBase {
  type:              "GENESIS";
  /** The AveryOS™ Kernel SHA-512 anchor embedded in the genesis block. */
  kernel_anchor:     string;
  /** The SHA-256 Genesis seed (e9a3 bridge). */
  genesis_sha256:    string;
  /** SKC version at genesis. */
  skc_version:       string;
}

export type VaultChainBlock =
  | VaultChainGenesis
  | VaultChainRecord
  | VaultChainCorrection
  | VaultChainAnchor;

// ── Minimal D1 binding types ───────────────────────────────────────────────────

interface D1Statement {
  run(): Promise<{ meta: { changes: number; last_row_id?: number } }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
interface D1Database {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── SHA-512 helper ─────────────────────────────────────────────────────────────

async function sha512Hex(text: string): Promise<string> {
  const encoder    = new TextEncoder();
  const data       = encoder.encode(text);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-512", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node.js fallback
  const { createHash } = await import("crypto");
  return createHash("sha512").update(text, "utf8").digest("hex");
}

// ── Canonical payload for hashing ─────────────────────────────────────────────

function canonicalPayload(fields: Record<string, unknown>): string {
  return JSON.stringify(fields, Object.keys(fields).sort());
}

// ── Table bootstrap ────────────────────────────────────────────────────────────

export async function ensureVaultChainTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS vaultchain_ledger (
      id               INTEGER  PRIMARY KEY AUTOINCREMENT,
      type             TEXT     NOT NULL,
      created_at       TEXT     NOT NULL,
      block_sha512     TEXT     NOT NULL,
      prev_sha512      TEXT,
      kernel_version   TEXT     NOT NULL,
      event            TEXT,
      payload          TEXT,
      corrects_id      INTEGER,
      corrects_sha512  TEXT,
      reason           TEXT,
      corrected_payload TEXT,
      chain_sha512     TEXT,
      btc_height       INTEGER,
      btc_hash         TEXT,
      kernel_anchor    TEXT,
      genesis_sha256   TEXT,
      skc_version      TEXT
    )
  `).bind().run();
}

// ── Fetch the latest block hash ────────────────────────────────────────────────

async function latestBlockSha(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare("SELECT block_sha512 FROM vaultchain_ledger ORDER BY id DESC LIMIT 1")
    .bind()
    .first<{ block_sha512: string }>();
  return row?.block_sha512 ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Append a standard RECORD block to the VaultChain™ ledger.
 *
 * @param db      D1 database binding.
 * @param event   Event label (e.g. 'BOT_HIT').
 * @param payload Arbitrary event payload (will be JSON-serialised).
 * @returns       The SHA-512 hash of the appended block.
 */
export async function appendRecord(
  db: D1Database,
  event: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const ts       = formatIso9();
  const prevSha  = await latestBlockSha(db);
  const payloadS = JSON.stringify(payload);
  const canonical = canonicalPayload({
    type:           "RECORD",
    event,
    payload:        payloadS,
    created_at:     ts,
    prev_sha512:    prevSha,
    kernel_version: KERNEL_VERSION,
  });
  const blockSha = await sha512Hex(canonical);

  await db.prepare(`
    INSERT INTO vaultchain_ledger
      (type, created_at, block_sha512, prev_sha512, kernel_version, event, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind("RECORD", ts, blockSha, prevSha, KERNEL_VERSION, event, payloadS).run();

  return blockSha;
}

/**
 * Append a CORRECTION block that supersedes a prior RECORD.
 *
 * This is the "Ledger Addition" pattern: history is never rewritten.
 * The original block remains intact; the correction block points to it
 * by ID and SHA-512 hash, then provides the corrected payload.
 *
 * @param db                D1 database binding.
 * @param correctsId        ID of the original RECORD block.
 * @param correctsSha512    SHA-512 hash of the original block (for verification).
 * @param reason            Human-readable correction reason.
 * @param correctedPayload  The corrected payload.
 * @returns                 SHA-512 hash of the appended correction block.
 */
export async function appendCorrection(
  db: D1Database,
  correctsId: number,
  correctsSha512: string,
  reason: string,
  correctedPayload: Record<string, unknown>,
): Promise<string> {
  const ts        = formatIso9();
  const prevSha   = await latestBlockSha(db);
  const correctedS = JSON.stringify(correctedPayload);
  const canonical  = canonicalPayload({
    type:              "CORRECTION",
    corrects_id:       correctsId,
    corrects_sha512:   correctsSha512,
    reason,
    corrected_payload: correctedS,
    created_at:        ts,
    prev_sha512:       prevSha,
    kernel_version:    KERNEL_VERSION,
  });
  const blockSha = await sha512Hex(canonical);

  await db.prepare(`
    INSERT INTO vaultchain_ledger
      (type, created_at, block_sha512, prev_sha512, kernel_version,
       corrects_id, corrects_sha512, reason, corrected_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    "CORRECTION", ts, blockSha, prevSha, KERNEL_VERSION,
    correctsId, correctsSha512, reason, correctedS,
  ).run();

  return blockSha;
}

/**
 * Append a periodic ANCHOR checkpoint to the chain.
 *
 * @param db         D1 database binding.
 * @param btcHeight  Optional Bitcoin block height.
 * @param btcHash    Optional Bitcoin block hash.
 * @returns          SHA-512 hash of the appended anchor block.
 */
export async function appendAnchor(
  db: D1Database,
  btcHeight?: number,
  btcHash?: string,
): Promise<string> {
  const ts      = formatIso9();
  const prevSha = await latestBlockSha(db);

  // Build running chain hash: SHA-512(prevChainSha || KERNEL_SHA || ts)
  const chainSha = await sha512Hex(`${prevSha ?? ""}${KERNEL_SHA}${ts}`);

  const canonical = canonicalPayload({
    type:           "ANCHOR",
    chain_sha512:   chainSha,
    created_at:     ts,
    prev_sha512:    prevSha,
    kernel_version: KERNEL_VERSION,
    ...(btcHeight !== undefined ? { btc_height: btcHeight } : {}),
    ...(btcHash   !== undefined ? { btc_hash:   btcHash   } : {}),
  });
  const blockSha = await sha512Hex(canonical);

  await db.prepare(`
    INSERT INTO vaultchain_ledger
      (type, created_at, block_sha512, prev_sha512, kernel_version,
       chain_sha512, btc_height, btc_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    "ANCHOR", ts, blockSha, prevSha, KERNEL_VERSION,
    chainSha,
    btcHeight ?? null,
    btcHash   ?? null,
  ).run();

  return blockSha;
}

/**
 * Bootstrap the GENESIS block if the ledger is empty.
 *
 * Idempotent: if the ledger already contains a GENESIS block this is a no-op.
 *
 * @param db  D1 database binding.
 * @returns   SHA-512 hash of the genesis block, or null if already exists.
 */
export async function bootstrapGenesis(db: D1Database): Promise<string | null> {
  // Check for existing genesis block
  const existing = await db
    .prepare("SELECT id FROM vaultchain_ledger WHERE type = 'GENESIS' LIMIT 1")
    .bind()
    .first<{ id: number }>();

  if (existing) return null;

  const ts     = formatIso9();
  const genesis256 = "e9a3cbcd8a0f4f58b1b3f3f0c5a8e1d7b2c9f4e6a0d3b7c1e5f8a2d4c6b9e3f0";
  const canonical  = canonicalPayload({
    type:           "GENESIS",
    kernel_anchor:  KERNEL_SHA,
    genesis_sha256: genesis256,
    kernel_version: KERNEL_VERSION,
    skc_version:    "SKC-2026.1",
    created_at:     ts,
    prev_sha512:    null,
  });
  const blockSha = await sha512Hex(canonical);

  await db.prepare(`
    INSERT INTO vaultchain_ledger
      (type, created_at, block_sha512, prev_sha512, kernel_version,
       kernel_anchor, genesis_sha256, skc_version)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
  `).bind(
    "GENESIS", ts, blockSha, KERNEL_VERSION,
    KERNEL_SHA, genesis256, "SKC-2026.1",
  ).run();

  return blockSha;
}

/**
 * Read the N most recent blocks from the VaultChain™ ledger.
 *
 * @param db    D1 database binding.
 * @param limit Maximum number of blocks to return (default: 20).
 */
export async function readRecentBlocks(
  db: D1Database,
  limit = 20,
): Promise<VaultChainBlock[]> {
  const rows = await (db
    .prepare("SELECT * FROM vaultchain_ledger ORDER BY id DESC LIMIT ?")
    .bind(limit) as unknown as {
      all<T>(): Promise<{ results: T[] }>
    }).all<VaultChainBlock>();
  return rows.results;
}
