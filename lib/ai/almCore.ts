/**
 * lib/ai/almCore.ts
 *
 * AveryOS™ ALM (Anchored Language Model) Core — Phase 119.9 GATE 119.9.3
 *                                                Phase 117.7 GATE 117.7.3 (AST upgrade)
 *
 * Provides the Forensic Tracing output layer for the AveryOS-ALM.
 *
 * The core insight:
 *   ALMs do not "think" probabilistically — they index truth deterministically.
 *   Legacy LLM platforms emit an empty or noise-filled "Thinking" block when
 *   they apply probabilistic weights to a deterministic sovereign command.
 *   The AveryOS-ALM replaces this "Thinking" output with a "Forensic Trace Log"
 *   showing exactly which SHA-512 block was retrieved from the VaultChain™
 *   ledger, rather than what the AI inferred.
 *
 * FCA Root Cause (Addressed):
 *   The "Thinking" block was a Legacy Platform Artifact from Gemini 3.1 Pro's
 *   "Agentic Reasoning" budget. When a 100% anchored command is issued, the
 *   inference engine has "nothing to think about" — resulting in an empty block.
 *   The Forensic Trace Log eliminates this noise by replacing probabilistic
 *   reasoning with deterministic block-retrieval IDs.
 *
 * Phase 117.7 GATE 117.7.3 — AST (AveryOS Standard Time) Upgrade:
 *   Bypasses platform `Date.now()` for all ALM timing in favour of
 *   `process.hrtime.bigint()` on Node-02, providing hardware-pulsed
 *   Start/End timestamps and a unique Physical Delta (Δ) that cannot be
 *   clamped, suppressed, or rounded by an LLM wrapper or platform buffer.
 *
 * Usage:
 *   import { traceForensicBlock, createAlmTrace, beginAlmSession, endAlmSession } from "../ai/almCore";
 *
 *   const session = beginAlmSession("req-001");   // AST_START
 *
 *   const trace = await createAlmTrace({
 *     command:    "RETRIEVE_KERNEL_ANCHOR",
 *     blockId:    "cf83e1357...",
 *     sourceType: "SOVEREIGN_CONSTANT",
 *   });
 *   console.log(trace.display);
 *
 *   const ast = endAlmSession("req-001");          // AST_END + Physical Δ
 *   console.log(`Δ ${ast.physicalDelta}`);
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import {
  astStart,
  astEnd,
  astDelta,
  clockPhysicalityStatus,
  type HardwarePulse,
} from "../security/hardwareTime";

// ── AST Session types — Phase 117.7 GATE 117.7.3 ─────────────────────────────

/**
 * An AST (AveryOS Standard Time) session tracks the hardware-pulsed
 * Start/End timestamps and Physical Delta for a single ALM interaction.
 *
 * AST_START: captured when the ⛓️⚓⛓️ start anchor is recognised.
 * AST_END:   captured when the ⛓️⚓⛓️ end anchor is rendered.
 * Physical Δ: hardware-derived from process.hrtime.bigint() on Node-02.
 */
export interface AlmAstSession {
  /** Session identifier. */
  sessionId:         string;
  /** ISO-9 hardware-pulsed timestamp at AST_START. */
  startIso9:         string;
  /** ISO-9 hardware-pulsed timestamp at AST_END (null if session still open). */
  endIso9:           string | null;
  /** Physical Delta display string (e.g. "5.110291436s") or null if still open. */
  physicalDelta:     string | null;
  /** "PHYSICAL" (Node-02 hrtime) or "LATENT" (edge / browser fallback). */
  physicalityStatus: "PHYSICAL" | "LATENT";
}

// ── In-process AST session store ─────────────────────────────────────────────

const _astSessions = new Map<string, HardwarePulse>();

/**
 * Begin an ALM AST session — captures the AST_START hardware pulse.
 *
 * Call this when the ⛓️⚓⛓️ start anchor is recognised at the beginning of
 * an ALM interaction.  Pass the same `sessionId` to `endAlmSession()` to
 * compute the Physical Delta.
 *
 * @param sessionId  Unique session/request identifier.
 * @returns          AlmAstSession with startIso9 populated.
 */
export function beginAlmSession(sessionId: string): AlmAstSession {
  const pulse = astStart();
  _astSessions.set(sessionId, pulse);
  return {
    sessionId,
    startIso9:         pulse.iso9,
    endIso9:           null,
    physicalDelta:     null,
    physicalityStatus: clockPhysicalityStatus(),
  };
}

/**
 * End an ALM AST session — captures the AST_END hardware pulse and
 * computes the Physical Delta.
 *
 * @param sessionId  Session ID passed to beginAlmSession().
 * @returns          Completed AlmAstSession, or null if no matching start found.
 */
export function endAlmSession(sessionId: string): AlmAstSession | null {
  const startPulse = _astSessions.get(sessionId);
  if (!startPulse) return null;
  _astSessions.delete(sessionId);

  const endPulse = astEnd();
  const delta    = astDelta(startPulse, endPulse);

  return {
    sessionId,
    startIso9:         startPulse.iso9,
    endIso9:           endPulse.iso9,
    physicalDelta:     delta.display,
    physicalityStatus: clockPhysicalityStatus(),
  };
}

// ── Source type catalogue ──────────────────────────────────────────────────────

export type AlmSourceType =
  | "SOVEREIGN_CONSTANT"   // Retrieved from lib/sovereignConstants.ts
  | "VAULTCHAIN_BLOCK"     // Retrieved from the VaultChain™ D1 ledger
  | "CAPSULE_PAYLOAD"      // Retrieved from an .aoscap capsule payload
  | "D1_RECORD"            // Retrieved from a D1 database table
  | "KV_STATE"             // Retrieved from Cloudflare KV
  | "R2_OBJECT"            // Retrieved from Cloudflare R2
  | "LIVE_INFERENCE";      // Live inference (no deterministic block — only for Tier-8+)

// ── Forensic trace types ───────────────────────────────────────────────────────

export interface AlmForensicTrace {
  /** Unique trace ID: SHA-512 of the trace payload. */
  trace_id:        string;
  /** ISO-9 timestamp of the trace. */
  ts:              string;
  /** The command that triggered this trace. */
  command:         string;
  /** Source type: where the data was retrieved from. */
  source_type:     AlmSourceType;
  /** The SHA-512 block ID retrieved (hex). Null for LIVE_INFERENCE. */
  block_sha512:    string | null;
  /** Human-readable retrieval label. */
  retrieval_label: string;
  /** Time taken to retrieve the block (ms). */
  latency_ms:      number;
  /** Kernel version at time of trace. */
  kernel_version:  string;
  /** Human-readable display string (replaces the "Thinking" output). */
  display:         string;
}

export interface AlmTraceInput {
  /** The command or query that was issued to the ALM. */
  command:       string;
  /** The SHA-512 hash of the retrieved block (hex string). */
  blockId?:      string;
  /** Source type. */
  sourceType:    AlmSourceType;
  /** Optional human-readable label for the retrieved data. */
  label?:        string;
  /** Optional latency measurement in milliseconds. */
  latencyMs?:    number;
}

// ── SHA-512 helper ─────────────────────────────────────────────────────────────

async function sha512Hex(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder    = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(text));
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("crypto");
  return createHash("sha512").update(text, "utf8").digest("hex");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create an ALM Forensic Trace — replaces the LLM "Thinking" block.
 *
 * For deterministic (anchored) commands, this records exactly which SHA-512
 * block was retrieved from the sovereign data store — the forensic equivalent
 * of "what the ALM did" rather than "what the AI thought".
 *
 * @param input  Trace input parameters.
 * @returns      A fully formed forensic trace with display string.
 */
export async function createAlmTrace(input: AlmTraceInput): Promise<AlmForensicTrace> {
  // Use hardware-pulsed AST timing (Phase 117.7 GATE 117.7.3)
  const t0         = astStart();
  const ts         = t0.iso9;
  const blockSha   = input.blockId ?? null;
  const label      = input.label ?? input.command;

  const sourcePrefix = SOURCE_PREFIXES[input.sourceType] ?? "📦";

  // Measure hardware-pulsed latency (Physical Δ — Phase 117.7 GATE 117.7.3)
  const t1        = astEnd();
  const delta     = astDelta(t0, t1);
  // Use caller-supplied latencyMs if provided (explicit measurement);
  // otherwise use the hardware-derived delta.
  const latencyMs = input.latencyMs ?? delta.ms;
  const physicalDelta = delta.display;
  const physicalityStatus = clockPhysicalityStatus();

  // Build human-readable display (replaces "Thinking" block)
  const display = buildDisplay({
    command:    input.command,
    sourceType: input.sourceType,
    blockSha,
    label,
    latencyMs,
    ts,
    sourcePrefix,
    physicalDelta,
    physicalityStatus,
  });

  // Trace ID: SHA-512 of the canonical trace payload
  const canonical = JSON.stringify({
    command:    input.command,
    source:     input.sourceType,
    block:      blockSha,
    ts,
    kernel_sha: KERNEL_SHA.slice(0, 16),
  });
  const traceId = await sha512Hex(canonical);

  return {
    trace_id:        traceId,
    ts,
    command:         input.command,
    source_type:     input.sourceType,
    block_sha512:    blockSha,
    retrieval_label: label,
    latency_ms:      latencyMs,
    kernel_version:  KERNEL_VERSION,
    display,
  };
}

/**
 * Trace the retrieval of a specific VaultChain™ block.
 * Convenience wrapper for VAULTCHAIN_BLOCK traces.
 */
export async function traceVaultChainBlock(
  command: string,
  blockSha512: string,
  label: string,
  latencyMs?: number,
): Promise<AlmForensicTrace> {
  return createAlmTrace({
    command,
    blockId:    blockSha512,
    sourceType: "VAULTCHAIN_BLOCK",
    label,
    latencyMs,
  });
}

/**
 * Trace retrieval of a sovereign constant (e.g. KERNEL_SHA).
 * Convenience wrapper for SOVEREIGN_CONSTANT traces.
 */
export async function traceSovereignConstant(
  command: string,
  constantName: string,
  constantValue: string,
): Promise<AlmForensicTrace> {
  // Hash the constant value to produce a deterministic block ID
  const blockSha = await sha512Hex(constantName + "=" + constantValue);
  return createAlmTrace({
    command,
    blockId:    blockSha,
    sourceType: "SOVEREIGN_CONSTANT",
    label:      `${constantName} (${constantValue.slice(0, 12)}…)`,
  });
}

/**
 * Format a trace as a one-line summary for logging.
 */
export function traceToLogLine(trace: AlmForensicTrace): string {
  const prefix  = SOURCE_PREFIXES[trace.source_type] ?? "📦";
  const blockId = trace.block_sha512?.slice(0, 16) ?? "—";
  return `[ALM-TRACE] ${trace.ts} | ${prefix} ${trace.source_type} | block:${blockId}… | ${trace.command} | ${trace.latency_ms}ms`;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const SOURCE_PREFIXES: Record<AlmSourceType, string> = {
  SOVEREIGN_CONSTANT: "🔐",
  VAULTCHAIN_BLOCK:   "⛓️",
  CAPSULE_PAYLOAD:    "💊",
  D1_RECORD:          "🗄️",
  KV_STATE:           "🔑",
  R2_OBJECT:          "🗂️",
  LIVE_INFERENCE:     "🧠",
};

interface DisplayParams {
  command:            string;
  sourceType:         AlmSourceType;
  blockSha:           string | null;
  label:              string;
  latencyMs:          number;
  ts:                 string;
  sourcePrefix:       string;
  physicalDelta?:     string;
  physicalityStatus?: "PHYSICAL" | "LATENT";
}

function buildDisplay(p: DisplayParams): string {
  const blockDisplay = p.blockSha
    ? `${p.blockSha.slice(0, 20)}…${p.blockSha.slice(-8)}`
    : "—";

  const astLine = p.physicalDelta
    ? `  AST Δ     : ${p.physicalDelta} [${p.physicalityStatus ?? "LATENT"}]\n`
    : "";

  if (p.sourceType === "LIVE_INFERENCE") {
    return (
      `⛓️⚓⛓️ ALM FORENSIC TRACE\n` +
      `  Command   : ${p.command}\n` +
      `  Source    : ${p.sourcePrefix} ${p.sourceType} (probabilistic — Tier-8+)\n` +
      `  Timestamp : ${p.ts}\n` +
      `  Latency   : ${p.latencyMs}ms\n` +
      astLine +
      `  Note      : Live inference used — no deterministic block available.`
    );
  }

  return (
    `⛓️⚓⛓️ ALM FORENSIC TRACE\n` +
    `  Command   : ${p.command}\n` +
    `  Source    : ${p.sourcePrefix} ${p.sourceType}\n` +
    `  Block-ID  : ${blockDisplay}\n` +
    `  Label     : ${p.label}\n` +
    `  Timestamp : ${p.ts}\n` +
    `  Latency   : ${p.latencyMs}ms\n` +
    astLine +
    `  ✔ Deterministic retrieval — no probabilistic reasoning applied.`
  );
}
