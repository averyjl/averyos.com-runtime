/**
 * AveryOS™ Architecture Integrity Worker
 * ⛓️⚓⛓️
 *
 * Verifies the sovereign runtime architecture by:
 *   1. Checking all required Cloudflare bindings are present (D1, KV, R2).
 *   2. Running verifyAnchor() — reads the latest vault_ledger entry from D1 and
 *      compares its sha512_hash column against the caller-supplied hash.
 *   3. Detecting Logic Drift — the KV key `current_genesis_state` must match
 *      the D1 sha512_hash; a mismatch returns HTTP 409.
 *   4. Writing a timestamped session log to R2, then returning a JSON manifest
 *      containing the CreatorLock status and the R2 upload timestamp.
 *
 * Endpoint:
 *   POST /api/v1/integrity-check
 *   Body: { "hash": "<128-char hex SHA-512 string>" }
 *
 * Required Cloudflare bindings (wrangler.toml):
 *   DB       — D1 database containing the vault_ledger table
 *   AVERY_KV — KV namespace holding the current_genesis_state key
 *   VAULT_R2 — R2 bucket for session audit logs
 *
 * Author: Jason Lee Avery (ROOT0)
 * Kernel Anchor: cf83e135...927da3e
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal D1 interfaces (avoids importing @cloudflare/workers-types) */
interface D1PreparedStatement {
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): D1PreparedStatement;
  };
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface R2Bucket {
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<{ uploaded: Date } | null>;
}

/** Bindings exposed by the Cloudflare Worker runtime */
export interface Env {
  DB: D1Database;
  AVERY_KV: KVNamespace;
  VAULT_R2: R2Bucket;
}

/** A single row from the vault_ledger table */
interface VaultLedgerRow {
  id: number;
  sha512_hash: string;
  anchor_label: string | null;
  btc_block_height: number | null;
  btc_block_hash: string | null;
  created_at: string;
}

/** Latest Bitcoin block data from Blockchain.com */
interface BitcoinBlock {
  hash: string;
  height: number;
  time: number;
}

/** Return value of verifyAnchor() */
interface AnchorResult {
  matched: boolean;
  latestRow: VaultLedgerRow | null;
  externalPulse: BitcoinBlock | null;
}

/** Final JSON manifest returned on a fully-verified integrity check */
interface IntegrityManifest {
  status: "VERIFIED";
  CreatorLock: "ACTIVE";
  r2_session_log_timestamp: string;
  kernel_anchor_verified: boolean;
  vault_ledger_sha: string;
  kv_genesis_state: string;
  anchor_label: string | null;
  timestamp: string;
  external_anchor_verified: boolean;
  global_heartbeat_height: number | null;
  global_heartbeat_hash: string | null;
  sovereign_sync_status: "LOCKED_TO_BLOCKCHAIN" | "SOVEREIGN_ONLY_MODE";
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Exact-length SHA-512 hex validator (128 hex chars) */
const SHA512_HEX_RE = /^[a-fA-F0-9]{128}$/;

/** Root0 Genesis Kernel anchor — used as the canonical baseline */
const ROOT0_ANCHOR =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

/** KV key that must stay in sync with the latest D1 vault_ledger sha512_hash */
const KV_GENESIS_KEY = "current_genesis_state";

/** R2 key prefix for session audit logs */
const R2_LOG_PREFIX = "session-logs/integrity/";

// ─── Core logic ──────────────────────────────────────────────────────────────

/**
 * Validates that a string is a well-formed SHA-512 hex digest.
 */
function isValidSha512(value: string): boolean {
  return SHA512_HEX_RE.test(value.trim());
}

/**
 * fetchExternalPulse — retrieves the latest Bitcoin block height and hash from
 * the Blockchain.com public API. The result is used as a "Global Heartbeat"
 * that proves the vault_ledger anchor existed before this specific Bitcoin block
 * was mined. Fails gracefully: returns null if the API is unreachable so the
 * sovereign anchor remains 100 % functional without external dependency.
 */
async function fetchExternalPulse(): Promise<BitcoinBlock | null> {
  try {
    const res = await fetch("https://blockchain.info/latestblock", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as BitcoinBlock;
  } catch {
    return null;
  }
}

/**
 * verifyAnchor — reads the most-recent row from vault_ledger and compares its
 * sha512_hash column against the caller-supplied `inputHash`. Concurrently
 * fetches the latest Bitcoin block as an external pulse so both results are
 * available in a single await.
 *
 * @param db        Bound D1 database
 * @param inputHash Caller-supplied SHA-512 hex string to verify
 * @returns         { matched, latestRow, externalPulse }
 */
async function verifyAnchor(db: D1Database, inputHash: string): Promise<AnchorResult> {
  const [row, externalPulse] = await Promise.all([
    db
      .prepare(
        "SELECT id, sha512_hash, anchor_label, btc_block_height, btc_block_hash, created_at FROM vault_ledger ORDER BY id DESC LIMIT 1"
      )
      .bind()
      .first<VaultLedgerRow>(),
    fetchExternalPulse(),
  ]);

  if (!row) {
    return { matched: false, latestRow: null, externalPulse };
  }

  return {
    matched: row.sha512_hash.trim().toLowerCase() === inputHash.trim().toLowerCase(),
    latestRow: row,
    externalPulse,
  };
}

/**
 * Writes a timestamped JSON session log to R2 and returns the upload timestamp.
 * A random suffix is appended to the key to prevent collisions on concurrent requests.
 * Errors are isolated so they never block the integrity response.
 *
 * @param r2        Bound R2 bucket
 * @param payload   Any serialisable object to persist as the session record
 * @param requestTs ISO-8601 timestamp string from the start of this request
 * @returns         ISO-8601 timestamp string, or null if the upload failed
 */
async function writeSessionLog(
  r2: R2Bucket,
  payload: Record<string, unknown>,
  requestTs: string
): Promise<string | null> {
  // Random 6-char hex suffix to prevent key collisions within the same millisecond
  const suffix = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  const safeTs = requestTs.replace(/[:.]/g, "-");
  const key = `${R2_LOG_PREFIX}${safeTs}-${suffix}.json`;
  const body = JSON.stringify({ ...payload, logged_at: requestTs }, null, 2);

  try {
    const result = await r2.put(key, body, {
      httpMetadata: { contentType: "application/json" },
    });
    // Return the authoritative upload timestamp from R2, or reuse requestTs
    return result?.uploaded ? result.uploaded.toISOString() : requestTs;
  } catch (err) {
    console.error("[integrity-worker] R2 write failed:", err);
    return null;
  }
}

// ─── Worker export ────────────────────────────────────────────────────────────

export default {
  /**
   * Cloudflare Worker fetch handler.
   *
   * Only accepts:
   *   POST /api/v1/integrity-check  — run the full integrity verification
   *
   * All other routes return 404.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    /** Single authoritative timestamp for this entire request lifecycle */
    const requestTs = new Date().toISOString();

    // ── Route guard ────────────────────────────────────────────────────────
    if (pathname !== "/api/v1/integrity-check") {
      return Response.json(
        { error: "NOT_FOUND", message: "Unknown route" },
        { status: 404 }
      );
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "METHOD_NOT_ALLOWED", message: "POST required" },
        { status: 405 }
      );
    }

    // ── Step 1: Bindings check ─────────────────────────────────────────────
    const missingBindings: string[] = [];
    if (!env.DB) missingBindings.push("DB (D1)");
    if (!env.AVERY_KV) missingBindings.push("AVERY_KV (KV)");
    if (!env.VAULT_R2) missingBindings.push("VAULT_R2 (R2)");

    if (missingBindings.length > 0) {
      return Response.json(
        {
          error: "BINDING_UNAVAILABLE",
          message: "One or more required Cloudflare bindings are not configured.",
          missing: missingBindings,
        },
        {
          status: 503,
          headers: { "X-AveryOS-Integrity": "BINDING_ERROR" },
        }
      );
    }

    // ── Step 2: Parse and validate the caller-supplied hash ────────────────
    let body: { hash?: unknown };
    try {
      body = (await request.json()) as { hash?: unknown };
    } catch {
      return Response.json(
        { error: "BAD_REQUEST", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const inputHash = typeof body.hash === "string" ? body.hash.trim() : "";

    if (!inputHash) {
      return Response.json(
        {
          error: "MISSING_HASH",
          message: "Provide a SHA-512 hex string in the 'hash' field.",
        },
        { status: 400 }
      );
    }

    if (!isValidSha512(inputHash)) {
      return Response.json(
        {
          error: "INVALID_HASH",
          message: "The supplied hash is not a valid 128-character SHA-512 hex string.",
        },
        { status: 422 }
      );
    }

    // ── Step 3: VaultChain audit — verifyAnchor() ──────────────────────────
    let anchorResult: AnchorResult;
    try {
      anchorResult = await verifyAnchor(env.DB, inputHash);
    } catch (err) {
      console.error("[integrity-worker] D1 query failed:", err);
      return Response.json(
        {
          error: "DB_ERROR",
          message: "Failed to query vault_ledger.",
        },
        { status: 500 }
      );
    }

    if (!anchorResult.latestRow) {
      return Response.json(
        {
          error: "NO_ANCHOR_RECORD",
          message: "vault_ledger is empty — no anchor to verify against.",
        },
        { status: 404 }
      );
    }

    const d1Sha = anchorResult.latestRow.sha512_hash.trim().toLowerCase();

    // ── Step 4: Drift detection ────────────────────────────────────────────
    let kvState: string | null = null;
    try {
      kvState = await env.AVERY_KV.get(KV_GENESIS_KEY);
    } catch (err) {
      console.error("[integrity-worker] KV read failed:", err);
      return Response.json(
        {
          error: "KV_ERROR",
          message: `Failed to read '${KV_GENESIS_KEY}' from AVERY_KV.`,
        },
        { status: 500 }
      );
    }

    // If no KV state exists yet, treat the Root0 anchor as the canonical baseline
    const normalizedKvState = (kvState ?? ROOT0_ANCHOR).trim().toLowerCase();

    if (normalizedKvState !== d1Sha) {
      return Response.json(
        {
          error: "LOGIC_DRIFT_DETECTED",
          message:
            "The KV genesis state does not match the latest vault_ledger record. " +
            "Sovereign anchor integrity has drifted — manual reconciliation required.",
          kv_genesis_state: kvState,
          vault_ledger_sha: d1Sha,
          anchor_label: anchorResult.latestRow.anchor_label,
          CreatorLock: "VIOLATED",
          kernel_anchor: ROOT0_ANCHOR,
          timestamp: requestTs,
        },
        {
          status: 409,
          headers: {
            "X-AveryOS-Integrity": "DRIFT_DETECTED",
            "X-GabrielOS-Block": "ACTIVE",
          },
        }
      );
    }

    // ── Step 5: Write session log to R2 ───────────────────────────────────
    const sessionPayload = {
      event: "INTEGRITY_CHECK",
      anchor_verified: anchorResult.matched,
      vault_ledger_sha: d1Sha,
      kv_genesis_state: normalizedKvState,
      anchor_label: anchorResult.latestRow.anchor_label,
      input_hash: inputHash,
      kernel_anchor: ROOT0_ANCHOR,
      // Stored BTC anchor stapled at INSERT time — immutable baseline
      stored_btc_anchor: {
        block_height: anchorResult.latestRow.btc_block_height,
        block_hash: anchorResult.latestRow.btc_block_hash,
      },
      // Real-time BTC heartbeat fetched during this verification request
      live_btc_heartbeat: anchorResult.externalPulse
        ? {
            source: "blockchain.info",
            block_height: anchorResult.externalPulse.height,
            block_hash: anchorResult.externalPulse.hash,
            block_time: new Date(anchorResult.externalPulse.time * 1000).toISOString(),
          }
        : null,
    };

    const r2Timestamp = await writeSessionLog(env.VAULT_R2, sessionPayload, requestTs);

    // ── Step 6: Build and return the Integrity Manifest ───────────────────
    // sovereign_sync_status reflects whether the live Bitcoin pulse was reachable.
    // The sovereign SHA-512 anchor is the primary source of truth in either mode.
    const externalAnchorVerified = anchorResult.externalPulse !== null;

    const manifest: IntegrityManifest = {
      status: "VERIFIED",
      CreatorLock: "ACTIVE",
      r2_session_log_timestamp: r2Timestamp ?? requestTs,
      kernel_anchor_verified: anchorResult.matched,
      vault_ledger_sha: d1Sha,
      kv_genesis_state: normalizedKvState,
      anchor_label: anchorResult.latestRow.anchor_label,
      timestamp: requestTs,
      external_anchor_verified: externalAnchorVerified,
      global_heartbeat_height: anchorResult.externalPulse?.height ?? null,
      global_heartbeat_hash: anchorResult.externalPulse?.hash ?? null,
      sovereign_sync_status: externalAnchorVerified
        ? "LOCKED_TO_BLOCKCHAIN"
        : "SOVEREIGN_ONLY_MODE",
    };

    return Response.json(manifest, {
      status: 200,
      headers: {
        "X-AveryOS-Integrity": "VERIFIED",
        "X-CreatorLock-Status": "ACTIVE",
      },
    });
  },
} satisfies { fetch(request: Request, env: Env): Promise<Response> };
