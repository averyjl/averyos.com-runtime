/**
 * lib/forensics/merkle.ts
 *
 * AveryOS™ Chat Merkle Engine — Phase 114.3 GATE 114.3.1
 *
 * Provides `generateChatMerkleRoot()` which:
 *   • SHA-256 hashes each prompt/reply pair individually.
 *   • Builds a session-level Merkle root from all pair hashes.
 *   • Persists the full chat archive (exact content, timestamps, SHAs)
 *     to the D1 `chat_archives` table.
 *
 * The Merkle construction:
 *   level-0 : SHA-256(prompt_text + reply_text) per exchange
 *   level-1+: SHA-256(left_child_hash + right_child_hash), repeated until root
 *
 * This allows individual exchanges to be verified against the root without
 * exposing the full chat content, satisfying the AveryOS™ forensic parity
 * requirement for legally-admissible session attestation.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatExchange {
  /** The full, exact prompt text (including hidden characters and emojis). */
  prompt:     string;
  /** The full, exact AI reply text (including hidden characters and emojis). */
  reply:      string;
  /** ISO-9 timestamp when the prompt was submitted. */
  promptAt:   string;
  /** ISO-9 timestamp when the reply was received. */
  replyAt:    string;
  /** Phase identifier (e.g. "114.3"). */
  phase?:     string;
}

export interface MerkleResult {
  /** Session-level Merkle root (hex string). */
  merkleRoot:  string;
  /** Individual leaf hashes (one per exchange). */
  leafHashes:  string[];
  /** Phase identifier from the first exchange, or "unknown". */
  phase:       string;
  /** ISO-9 timestamp of the first exchange. */
  sessionStart: string;
  /** Total number of exchanges in this session. */
  exchangeCount: number;
}

// ── Minimal D1 binding types ───────────────────────────────────────────────────
interface D1Statement {
  run(): Promise<void>;
}
interface D1Database {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
  batch(stmts: D1Statement[]): Promise<unknown[]>;
}

// ── SHA-256 helper (Web Crypto / Node crypto) ──────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(text);
  let hashBuffer: ArrayBuffer;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    // Web Crypto (Cloudflare Worker / browser)
    hashBuffer = await crypto.subtle.digest("SHA-256", data);
  } else {
    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto") as { createHash(alg: string): { update(d: Buffer): { digest(enc: string): string } } };
    return nodeCrypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
  }

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Merkle tree construction ───────────────────────────────────────────────────

/**
 * Build a Merkle root from an array of leaf hashes.
 * - Odd number of leaves: duplicate the last leaf.
 * - Returns the leaf itself if there is only one leaf.
 */
async function buildMerkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return await sha256Hex("empty-session");
  if (leaves.length === 1) return leaves[0];

  let current = [...leaves];
  while (current.length > 1) {
    if (current.length % 2 !== 0) current.push(current[current.length - 1]);
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(await sha256Hex(current[i] + current[i + 1]));
    }
    current = next;
  }
  return current[0];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a Merkle root for a complete chat session and optionally persist
 * the full archive to D1.
 *
 * @param exchanges  - Ordered list of prompt/reply pairs.
 * @param sessionId  - Unique session identifier (used as the D1 chat_name).
 * @param db         - Optional D1 database binding. Pass `null` to skip persistence.
 * @returns          - `MerkleResult` containing the root and leaf hashes.
 */
export async function generateChatMerkleRoot(
  exchanges: ChatExchange[],
  sessionId: string,
  db:        D1Database | null,
): Promise<MerkleResult> {
  if (exchanges.length === 0) {
    throw new Error("generateChatMerkleRoot: exchanges array must not be empty");
  }

  const leafHashes: string[] = [];
  const dbStmts:   D1Statement[] = [];

  for (let i = 0; i < exchanges.length; i++) {
    const ex = exchanges[i];
    // Hash: full exact content of both prompt and reply, preserving every byte.
    const leafHash = await sha256Hex(ex.prompt + "\x00" + ex.reply);
    leafHashes.push(leafHash);

    if (db) {
      const promptSha = await sha256Hex(ex.prompt);
      const replySha  = await sha256Hex(ex.reply);
      dbStmts.push(
        db.prepare(
          `INSERT INTO chat_archives
             (session_id, exchange_index, phase, prompt_text, reply_text,
              prompt_sha256, reply_sha256, leaf_hash,
              prompt_at, reply_at, kernel_sha, kernel_version, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          sessionId,
          i,
          ex.phase ?? "unknown",
          ex.prompt,
          ex.reply,
          promptSha,
          replySha,
          leafHash,
          ex.promptAt,
          ex.replyAt,
          KERNEL_SHA,
          KERNEL_VERSION,
          formatIso9(),
        ),
      );
    }
  }

  const merkleRoot = await buildMerkleRoot(leafHashes);

  // Persist archives in a single batch for atomicity.
  if (db && dbStmts.length > 0) {
    // Update all rows with the final Merkle root once we have it.
    const updateStmts = dbStmts.map((_s, i) =>
      db.prepare(
        `UPDATE chat_archives SET merkle_root = ? WHERE session_id = ? AND exchange_index = ?`
      ).bind(merkleRoot, sessionId, i),
    );
    try {
      await db.batch([...dbStmts, ...updateStmts]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ChatMerkle] D1 batch write failed:", msg);
      // Non-fatal: still return the computed root.
    }
  }

  return {
    merkleRoot,
    leafHashes,
    phase:         exchanges[0].phase ?? "unknown",
    sessionStart:  exchanges[0].promptAt,
    exchangeCount: exchanges.length,
  };
}
