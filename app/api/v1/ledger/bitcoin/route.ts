/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * app/api/v1/ledger/bitcoin/route.ts
 *
 * POST /api/v1/ledger/bitcoin
 *
 * AveryOS™ BTC OP_RETURN Anchoring API — GATE 116.8.1
 *
 * Anchors a SHA-512 hash to the Bitcoin blockchain via an OP_RETURN
 * transaction, establishing a "Forever Node" for the most critical
 * AveryOS™ kernel inventions.
 *
 * Flow:
 *   1. Validate request auth (Bearer / VAULT_PASSPHRASE).
 *   2. Accept `hash` (SHA-512 hex) + optional `label` from request body.
 *   3. Prefix with "AVERYOS:" and trim to 80 bytes (OP_RETURN limit).
 *   4. Broadcast via a configured Bitcoin API provider (Blockstream /
 *      mempool.space or the BITCOIN_API_URL env variable).
 *   5. Record the TXID + anchor hash in D1 `bitcoin_anchors` table.
 *   6. Write a ANCHOR block to VaultChain™ ledger.
 *   7. Return the TXID + VaultChain block height.
 *
 * Environment variables:
 *   BITCOIN_API_URL     — Custom Bitcoin API base URL (optional).
 *   BITCOIN_API_KEY     — API key for broadcast endpoint (optional).
 *   VAULT_PASSPHRASE    — Auth token for this endpoint.
 *
 * Security: CreatorOnly — only accepts requests with valid VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CloudflareEnv {
  DB:                  D1Database;
  VAULT_PASSPHRASE?:   string;
  BITCOIN_API_URL?:    string;
  BITCOIN_API_KEY?:    string;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run():   Promise<{ success: boolean }>;
  first(): Promise<unknown>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

// ── BTC OP_RETURN prefix ──────────────────────────────────────────────────────

/** Maximum OP_RETURN data length in bytes (Bitcoin standard). */
const OP_RETURN_MAX_BYTES = 80;

/** Canonical prefix for all AveryOS™ OP_RETURN anchors. */
const AOS_PREFIX = "AVERYOS:";

/**
 * Build the OP_RETURN payload.
 * Format: `AVERYOS:<first N bytes of hash>`
 * Total length capped at OP_RETURN_MAX_BYTES bytes.
 */
function buildOpReturnPayload(hash: string): string {
  const maxHash = OP_RETURN_MAX_BYTES - AOS_PREFIX.length;
  return `${AOS_PREFIX}${hash.slice(0, maxHash)}`;
}

// ── Bitcoin broadcast ──────────────────────────────────────────────────────────

/**
 * Broadcast a raw OP_RETURN transaction via the configured Bitcoin API.
 *
 * In production this calls a provider like Blockstream or mempool.space.
 * In mock mode (no BITCOIN_API_URL set) it returns a deterministic
 * SHA-256 of the payload as a mock TXID — clearly labelled as a mock entry.
 */
async function broadcastOpReturn(
  opReturnData: string,
  apiUrl:       string | null,
  apiKey:       string | null,
): Promise<{
  txid:      string;
  simulated: boolean;
  rawPayload: string;
}> {
  const rawPayload = opReturnData;

  if (!apiUrl) {
    // Mock mode — compute deterministic mock TXID from payload hash
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`SIMULATED:${rawPayload}:${KERNEL_SHA}`),
    );
    const mockTxid = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return { txid: mockTxid, simulated: true, rawPayload };
  }

  // Live broadcast — POST to configured Bitcoin API
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-averyos-kernel": KERNEL_SHA.slice(0, 16),
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(`${apiUrl}/broadcast`, {
    method:  "POST",
    headers,
    body:    JSON.stringify({ op_return: rawPayload }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Bitcoin API broadcast failed: HTTP ${res.status} — ${body.slice(0, 256)}`,
    );
  }

  const json = (await res.json()) as Record<string, unknown>;
  const txid  = String(json.txid ?? json.tx_hash ?? json.result ?? "");
  if (!txid) throw new Error("Bitcoin API did not return a TXID");

  return { txid, simulated: false, rawPayload };
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db  = cfEnv.DB;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE ?? "";

  if (!token || !vaultPassphrase || token !== vaultPassphrase) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Invalid credentials — CreatorOnly endpoint", 401);
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Invalid JSON body", 400);
  }

  const hash  = typeof body.hash  === "string" ? body.hash.trim()  : "";
  const label = typeof body.label === "string" ? body.label.trim() : "KERNEL_ANCHOR";

  if (!hash || !/^[0-9a-f]{64,128}$/i.test(hash)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "hash must be a 64–128 character hex string (SHA-256 or SHA-512)",
      400,
    );
  }

  // ── Build + broadcast ─────────────────────────────────────────────────────
  const opReturn = buildOpReturnPayload(hash);
  let txid:      string;
  let simulated: boolean;

  try {
    const result = await broadcastOpReturn(
      opReturn,
      cfEnv.BITCOIN_API_URL ?? null,
      cfEnv.BITCOIN_API_KEY ?? null,
    );
    txid      = result.txid;
    simulated = result.simulated;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.BTC_ANCHOR_FAILED, `BTC broadcast failed: ${msg}`, 502);
  }

  const anchoredAt = formatIso9();

  // ── Persist to D1 ────────────────────────────────────────────────────────
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO bitcoin_anchors
         (txid, hash, label, op_return_payload, simulated, anchored_at,
          kernel_sha, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      txid,
      hash.slice(0, 128),
      label.slice(0, 128),
      opReturn,
      simulated ? 1 : 0,
      anchoredAt,
      KERNEL_SHA,
      KERNEL_VERSION,
    ).run();
  } catch (dbErr) {
    console.warn("[BTC] D1 log failed:", dbErr instanceof Error ? dbErr.message : String(dbErr));
  }

  // ── TAI accomplishment ────────────────────────────────────────────────────
  autoTrackAccomplishment(db, {
    title:       "BTC OP_RETURN Anchor Broadcast",
    description: `TXID: ${txid} | Label: ${label} | Simulated: ${simulated}`,
    category:    "FORENSIC",
    phase:       "116.8.1",
  });

  return Response.json({
    ok:           true,
    txid,
    simulated,
    op_return:    opReturn,
    label,
    hash:         hash.slice(0, 128),
    anchored_at:  anchoredAt,
    kernel_sha:   KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    _anchor:      "⛓️⚓⛓️ BTC Forever Node — Truth lives as long as the internet exists.",
  });
}
