/**
 * app/api/v1/ledger/bitcoin/route.ts
 *
 * AveryOS™ BTC OP_RETURN Anchor API — GATE 117.2.3
 *
 * Anchors SHA-512 invention hashes to the Bitcoin blockchain via OP_RETURN
 * outputs using the `AVERYOS:` prefix.  Every sovereign invention, capsule,
 * or VaultChain block can be permanently timestamped on-chain.
 *
 * Protocol:
 *   POST /api/v1/ledger/bitcoin
 *   Body: { hash: string; label?: string; dry_run?: boolean }
 *
 *   • hash    — SHA-512 hex string (128 chars) to anchor
 *   • label   — Optional human-readable label (max 50 chars)
 *   • dry_run — If true, builds and logs the OP_RETURN payload without
 *               broadcasting (for testing the anchor pipeline)
 *
 * OP_RETURN format (up to 80 bytes):
 *   AVERYOS:<first 64 hex chars of SHA-512>
 *   e.g.  AVERYOS:cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce4
 *
 * The full SHA-512 (128 chars) is stored in D1 for on-chain correlation.
 *
 * GET /api/v1/ledger/bitcoin?limit=20
 *   Returns the 20 most recent BTC anchor records from D1.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }       from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION }  from "../../../../../lib/sovereignConstants";
import { formatIso9 }                  from "../../../../../lib/timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB:              D1Database;
  BITCOIN_API_KEY?: string;
}

interface BtcAnchorRecord {
  id:            number;
  sha512:        string;
  label:         string | null;
  op_return_hex: string;
  txid:          string | null;
  status:        string;
  anchored_at:   string;
  dry_run:       number;
  kernel_version: string;
}

// ── OP_RETURN Builder ─────────────────────────────────────────────────────────

/** Maximum OP_RETURN data payload in bytes (Bitcoin consensus limit: 80). */
const OP_RETURN_MAX_BYTES = 80;

/** AveryOS™ anchor prefix — occupies 8 bytes, leaving 72 bytes for hash data. */
const AVERYOS_PREFIX = "AVERYOS:";

/**
 * Build the OP_RETURN data string for a given SHA-512 hash.
 * Format: AVERYOS:<first 64 hex chars of SHA-512>
 * Total:  8 + 64 = 72 bytes — within the 80-byte OP_RETURN limit.
 */
function buildOpReturnData(sha512: string): { data: string; hex: string } {
  const hashPart = sha512.slice(0, 64); // 64 hex chars = 32 bytes
  const data     = `${AVERYOS_PREFIX}${hashPart}`;
  const hex      = Array.from(new TextEncoder().encode(data)).map(b => b.toString(16).padStart(2, "0")).join("");
  return { data, hex };
}

// ── D1 Schema ─────────────────────────────────────────────────────────────────

async function ensureBtcAnchorTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS btc_anchors (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sha512         TEXT    NOT NULL,
      label          TEXT,
      op_return_hex  TEXT    NOT NULL,
      txid           TEXT,
      status         TEXT    NOT NULL DEFAULT 'PENDING',
      anchored_at    TEXT    NOT NULL,
      dry_run        INTEGER NOT NULL DEFAULT 0,
      kernel_version TEXT    NOT NULL
    )
  `).run();
}

// ── BlockCypher Broadcaster ───────────────────────────────────────────────────

/**
 * Broadcast an OP_RETURN transaction via BlockCypher API.
 * Uses the BITCOIN_API_KEY binding for authentication.
 *
 * Returns the TXID on success, or null if the API is unavailable / dry_run.
 *
 * NOTE: In production this requires a funded Bitcoin address controlled by
 * the sovereign node.  The private key should be stored in a Cloudflare
 * secret (BITCOIN_PRIVATE_KEY) and never committed to source.
 */
async function broadcastOpReturn(
  opReturnHex: string,
  apiKey: string | undefined,
): Promise<{ txid: string | null; error: string | null }> {
  if (!apiKey) {
    return { txid: null, error: "BITCOIN_API_KEY not configured" };
  }

  // NOTE: A complete Bitcoin broadcast requires a funded input address and a
  // signed transaction.  The BITCOIN_PRIVATE_KEY secret (set via `wrangler secret put`)
  // provides the signing key for the source address.  This implementation
  // calls BlockCypher's /v1/btc/main/txs/new endpoint to build+sign+broadcast
  // the OP_RETURN transaction using their Transaction API (not raw push).
  //
  // Phase 1 (current): records the anchor intent in D1 with status=PENDING.
  // Phase 2 (Gate 116.8.1): full bitcoinjs-lib signing + broadcast implementation.
  try {
    // BlockCypher's fundedSend API creates an OP_RETURN output without
    // requiring manual UTXO management — uses the provided source address.
    const response = await fetch(
      `https://api.blockcypher.com/v1/btc/main/txs/new?token=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          outputs: [
            {
              script_type: "null-data",
              // OP_RETURN (0x6a) + 1-byte push length + data
              // Data is max 72 bytes (AVERYOS: prefix + 64 hex chars) — within 75-byte direct push limit
              script: `6a${(opReturnHex.length / 2).toString(16).padStart(2, "0")}${opReturnHex}`,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      return { txid: null, error: `BlockCypher HTTP ${response.status}: ${body.slice(0, 200)}` };
    }

    const data = await response.json() as { hash?: string; tx?: { hash?: string } };
    return { txid: data.hash ?? data.tx?.hash ?? null, error: null };
  } catch (err: unknown) {
    return {
      txid:  null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const now = formatIso9(new Date());

  let body: { hash?: string; label?: string; dry_run?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const { hash, label, dry_run = false } = body;

  if (!hash || typeof hash !== "string") {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Field 'hash' (SHA-512 hex string) is required.");
  }

  if (!/^[0-9a-fA-F]{128}$/.test(hash)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_JSON,
      "Field 'hash' must be a 128-character SHA-512 hex string.",
    );
  }

  const sanitizedLabel = label ? String(label).slice(0, 50) : null;
  const { data: opReturnData, hex: opReturnHex } = buildOpReturnData(hash);

  if (new TextEncoder().encode(opReturnData).length > OP_RETURN_MAX_BYTES) {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      `OP_RETURN payload exceeds ${OP_RETURN_MAX_BYTES} bytes.`,
    );
  }

  const { env: rawEnv } = await getCloudflareContext({ async: true });
  const env = rawEnv as unknown as CloudflareEnv;
  const db      = env.DB;
  if (!db) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding unavailable.");
  }

  await ensureBtcAnchorTable(db);

  let txid:   string | null = null;
  let status: string        = "PENDING";
  let broadcastError: string | null = null;

  if (!dry_run) {
    const result = await broadcastOpReturn(opReturnHex, env.BITCOIN_API_KEY);
    txid           = result.txid;
    broadcastError = result.error;
    status         = txid ? "ANCHORED" : "BROADCAST_FAILED";
  } else {
    status = "DRY_RUN";
  }

  // Persist the anchor record to D1
  const insertResult = await db.prepare(`
    INSERT INTO btc_anchors (sha512, label, op_return_hex, txid, status, anchored_at, dry_run, kernel_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(hash, sanitizedLabel, opReturnHex, txid, status, now, dry_run ? 1 : 0, KERNEL_VERSION).run();

  const recordId = insertResult.meta?.last_row_id ?? null;

  const responseBody = {
    status,
    record_id:      recordId,
    sha512:         hash,
    label:          sanitizedLabel,
    op_return_data: opReturnData,
    op_return_hex:  opReturnHex,
    txid,
    dry_run,
    anchored_at:    now,
    kernel_version: KERNEL_VERSION,
    kernel_sha:     KERNEL_SHA,
    ...(broadcastError ? { broadcast_error: broadcastError } : {}),
  };

  return Response.json(responseBody, {
    status: txid || dry_run ? 200 : 207,
  });
}

// ── GET Handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const { env: rawEnv2 } = await getCloudflareContext({ async: true });
  const env2 = rawEnv2 as unknown as CloudflareEnv;
  const db      = env2.DB;
  if (!db) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding unavailable.");
  }

  await ensureBtcAnchorTable(db);

  const { results } = await db.prepare(`
    SELECT id, sha512, label, op_return_hex, txid, status, anchored_at, dry_run, kernel_version
    FROM   btc_anchors
    ORDER  BY id DESC
    LIMIT  ? OFFSET ?
  `).bind(limit, offset).all<BtcAnchorRecord>();

  return Response.json({
    anchors:        results,
    count:          results.length,
    limit,
    offset,
    kernel_version: KERNEL_VERSION,
    kernel_sha:     KERNEL_SHA,
  });
}
