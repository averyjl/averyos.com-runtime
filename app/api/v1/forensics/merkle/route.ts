/**
 * POST /api/v1/forensics/merkle
 *
 * AveryOS™ Chat Merkle Archive API — Phase 114 GATE 4
 *
 * Receives an array of chat exchanges (prompt/reply pairs), computes a
 * session-level Merkle root using SHA-512, and persists the full archive
 * to the D1 `chat_archives` table.
 *
 * This endpoint is the server-side gate for `lib/forensics/merkle.ts`.
 * It provides legally-admissible session attestation and VaultChain™ forensic
 * parity by anchoring every chat interaction to the sovereign kernel.
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * Request body (JSON):
 * {
 *   "session_id": string,       // Unique session identifier (ChatName + Date + Phase)
 *   "exchanges": [
 *     {
 *       "prompt":   string,     // Full exact prompt text (including hidden chars / emojis)
 *       "reply":    string,     // Full exact reply text
 *       "promptAt": string,     // ISO-9 timestamp of prompt submission
 *       "replyAt":  string,     // ISO-9 timestamp of reply receipt
 *       "phase":    string?     // Phase identifier (e.g. "114.3")
 *     }
 *   ]
 * }
 *
 * Response (200):
 * {
 *   ok: true,
 *   session_id: string,
 *   merkle_root: string,        // SHA-512 Merkle root (hex)
 *   leaf_count: number,
 *   phase: string,
 *   session_start: string,
 *   persisted: boolean,         // true when D1 write succeeded
 *   kernel_sha: string,
 *   kernel_version: string,
 *   archived_at: string
 * }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }       from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 }                 from "../../../../../lib/timePrecision";
import { safeEqual }                  from "../../../../../lib/taiLicenseGate";
import {
  generateChatMerkleRoot,
  type ChatExchange,
  type MerkleD1Database,
}                                     from "../../../../../lib/forensics/merkle";

// ── Minimal D1 binding interfaces ─────────────────────────────────────────────

interface CloudflareEnv {
  DB?:              MerkleD1Database;
  VAULT_PASSPHRASE?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    // ── Auth: Bearer VAULT_PASSPHRASE ─────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const expected   = cfEnv.VAULT_PASSPHRASE ?? "";
    if (!expected || !safeEqual(token, expected)) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Valid VAULT_PASSPHRASE Bearer token required.");
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let sessionId: string;
    let rawExchanges: unknown[];
    try {
      const body = await request.json() as { session_id?: unknown; exchanges?: unknown };
      if (typeof body.session_id !== "string" || !body.session_id.trim()) {
        return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "session_id must be a non-empty string.");
      }
      if (!Array.isArray(body.exchanges) || body.exchanges.length === 0) {
        return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "exchanges must be a non-empty array.");
      }
      sessionId    = body.session_id.trim().slice(0, 256);
      rawExchanges = body.exchanges;
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
    }

    // ── Validate and normalise exchanges ──────────────────────────────────────
    const exchanges: ChatExchange[] = [];
    let exIdx = 0;
    for (const rawEx of rawExchanges) {
      const ex = rawEx as Record<string, unknown>;
      if (typeof ex.prompt !== "string" || typeof ex.reply !== "string") {
        return aosErrorResponse(
          AOS_ERROR.INVALID_FIELD,
          `exchanges[${exIdx}]: prompt and reply must be strings.`,
        );
      }
      exchanges.push({
        prompt:   ex.prompt,
        reply:    ex.reply,
        promptAt: typeof ex.promptAt === "string" ? ex.promptAt : formatIso9(),
        replyAt:  typeof ex.replyAt  === "string" ? ex.replyAt  : formatIso9(),
        phase:    typeof ex.phase    === "string" ? ex.phase    : undefined,
      });
      exIdx += 1;
    }

    // ── Generate Merkle root and persist ──────────────────────────────────────
    const db = cfEnv.DB ?? null;
    const result = await generateChatMerkleRoot(exchanges, sessionId, db);

    const archivedAt = formatIso9();

    return Response.json({
      ok:              true,
      session_id:      sessionId,
      merkle_root:     result.merkleRoot,
      leaf_count:      result.leafHashes.length,
      phase:           result.phase,
      session_start:   result.sessionStart,
      exchange_count:  result.exchangeCount,
      persisted:       db !== null,
      kernel_sha:      KERNEL_SHA,
      kernel_version:  KERNEL_VERSION,
      archived_at:     archivedAt,
    });

  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      err instanceof Error ? err.message : "Chat Merkle archive failed.",
    );
  }
}
