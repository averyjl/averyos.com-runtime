/**
 * lib/forensics/agentSummary.ts
 *
 * AveryOS™ Agent Summary Protocol — Phase 117.3 GATE 117.3.5
 *
 * Provides `writeAgentSummary()` — the canonical method for finalising an
 * AI/LLM agent session by writing a structured AOSR (AveryOS™ Session Record)
 * summary to `logs/agent_summary.aosvault`.
 *
 * The `.aosvault` file is append-only, newline-delimited JSON (NDJSON).  Each
 * line is one AOSR summary record.  The file is gitignored (private sovereign
 * runtime state) and must never be committed.
 *
 * Structure of an AOSR record:
 * ```json
 * {
 *   "schema":        "AOSR-1.0",
 *   "phase":         "117.3",
 *   "sessionId":     "...",
 *   "agentId":       "...",
 *   "completedAt":   "...",
 *   "kernelSha":     "cf83...",
 *   "kernelVersion": "v3.6.2",
 *   "summary":       "...",
 *   "gatesCompleted": [...],
 *   "usiCount":      0,
 *   "physicalCount": 0,
 *   "latentCount":   0,
 *   "merkleRoot":    "..."
 * }
 * ```
 *
 * This module is safe to import in both Node.js (scripts/) and edge runtimes.
 * In edge runtimes the file I/O path is skipped and the AOSR is returned as
 * a JSON string so the caller can persist it via another mechanism (e.g. KV,
 * R2, or console log).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 }                 from "../timePrecision";

// ── AOSR record type ──────────────────────────────────────────────────────────

export interface AosrRecord {
  /** Schema identifier — always "AOSR-1.0". */
  schema:          "AOSR-1.0";
  /** AveryOS™ phase this session was completed under. */
  phase:           string;
  /** Unique session identifier (caller-supplied or auto-generated). */
  sessionId:       string;
  /** Identifier of the AI agent (e.g. "copilot", "claude", "gemini"). */
  agentId:         string;
  /** ISO-9 timestamp when the summary was written. */
  completedAt:     string;
  /** Root0 Kernel SHA-512 anchor. */
  kernelSha:       string;
  /** Kernel version. */
  kernelVersion:   string;
  /** Human-readable summary of what the agent accomplished. */
  summary:         string;
  /** List of gate IDs completed in this session (e.g. ["117.3.1", "117.3.2"]). */
  gatesCompleted:  string[];
  /** Number of USI violations raised during the session. */
  usiCount:        number;
  /** Number of modules that reached PHYSICAL_TRUTH during the session. */
  physicalCount:   number;
  /** Number of modules still in LATENT_ARTIFACT or LATENT_PENDING state. */
  latentCount:     number;
  /** Session-level Merkle root over all gate records (hex string or "PENDING"). */
  merkleRoot:      string;
}

// ── Input type ────────────────────────────────────────────────────────────────

export interface AosrInput {
  /** Unique session ID.  Auto-generated (ISO-9 + random) if omitted. */
  sessionId?:      string;
  /** AI agent identifier.  Defaults to "copilot". */
  agentId?:        string;
  /** Phase label.  Defaults to "117.3". */
  phase?:          string;
  /** Human-readable summary of the session. */
  summary:         string;
  /** Gates completed.  Defaults to []. */
  gatesCompleted?: string[];
  /** USI violation count.  Defaults to 0. */
  usiCount?:       number;
  /** Physical module count.  Defaults to 0. */
  physicalCount?:  number;
  /** Latent module count.  Defaults to 0. */
  latentCount?:    number;
  /** Pre-computed Merkle root.  Defaults to "PENDING". */
  merkleRoot?:     string;
}

// ── Log path constant ─────────────────────────────────────────────────────────

export const AGENT_SUMMARY_LOG_PATH = "logs/agent_summary.aosvault";

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * writeAgentSummary — creates or appends an AOSR record to
 * `logs/agent_summary.aosvault`.
 *
 * Node.js environments: the record is appended as a newline-delimited JSON
 * line to the file path above (relative to `process.cwd()`).  The `logs/`
 * directory is created if it does not exist.
 *
 * Edge runtimes (no filesystem): the record is returned as a JSON string for
 * the caller to persist via R2 or KV.
 *
 * @param input — session details (see AosrInput).
 * @returns the AOSR record that was written.
 */
export async function writeAgentSummary(input: AosrInput): Promise<AosrRecord> {
  const completedAt = formatIso9();
  const sessionId   = input.sessionId ?? `session-${completedAt}`;

  const record: AosrRecord = {
    schema:         "AOSR-1.0",
    phase:          input.phase          ?? "117.3",
    sessionId,
    agentId:        input.agentId        ?? "copilot",
    completedAt,
    kernelSha:      KERNEL_SHA,
    kernelVersion:  KERNEL_VERSION,
    summary:        input.summary,
    gatesCompleted: input.gatesCompleted ?? [],
    usiCount:       input.usiCount       ?? 0,
    physicalCount:  input.physicalCount  ?? 0,
    latentCount:    input.latentCount    ?? 0,
    merkleRoot:     input.merkleRoot     ?? "PENDING",
  };

  // ── Filesystem path (Node.js only) ─────────────────────────────────────────
  if (
    typeof process !== "undefined" &&
    typeof process.cwd === "function" &&
    typeof process.versions?.node === "string"
  ) {
    try {
      const { appendFileSync, mkdirSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const logPath  = join(process.cwd(), AGENT_SUMMARY_LOG_PATH);
      const logDir   = join(process.cwd(), "logs");
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      appendFileSync(logPath, JSON.stringify(record) + "\n", "utf8");
    } catch (err) {
      // Non-fatal — warn but do not throw; edge callers without fs still get record.
      console.warn(
        "[agentSummary] Could not write to filesystem:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return record;
}

/**
 * buildAgentSummaryJson — convenience helper that returns the AOSR record as
 * a formatted JSON string without writing to disk.  Useful for embedding in
 * API responses or R2/KV writes.
 */
export function buildAgentSummaryJson(input: AosrInput): string {
  const completedAt = formatIso9();
  const record: AosrRecord = {
    schema:         "AOSR-1.0",
    phase:          input.phase          ?? "117.3",
    sessionId:      input.sessionId      ?? `session-${completedAt}`,
    agentId:        input.agentId        ?? "copilot",
    completedAt,
    kernelSha:      KERNEL_SHA,
    kernelVersion:  KERNEL_VERSION,
    summary:        input.summary,
    gatesCompleted: input.gatesCompleted ?? [],
    usiCount:       input.usiCount       ?? 0,
    physicalCount:  input.physicalCount  ?? 0,
    latentCount:    input.latentCount    ?? 0,
    merkleRoot:     input.merkleRoot     ?? "PENDING",
  };
  return JSON.stringify(record, null, 2);
}
