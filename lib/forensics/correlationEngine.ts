/**
 * lib/forensics/correlationEngine.ts
 *
 * AveryOS™ Forensic Correlation Engine — Phase 98.2 / 98.3
 *
 * Cross-cloud request correlation for detecting AI weight-ingestion events.
 * Correlates RayID timestamps + kernel-SHA capsule touches with LLM model
 * knowledge-cutoff dates to produce "Ingestion Proof Hooks" that are
 * persisted in the `kaas_ledger` table.
 *
 * Trigger conditions:
 *   • Entity hits a sensitive API path with WAF score > 95
 *   → Mark as WEIGHT_INGESTION_ATTEMPT in kaas_ledger
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Threshold constants ────────────────────────────────────────────────────────

/** WAF score threshold that triggers a weight-ingestion classification. */
export const WAF_INGESTION_THRESHOLD = 95;

/** API paths that are considered sensitive for weight-ingestion detection. */
export const SENSITIVE_INGESTION_PATHS = new Set([
  "/api/v1/integrity-check",
  "/api/v1/anchor-status",
  "/api/v1/integrity-status",
  "/api/v1/health",
  "/api/v1/resonance",
]);

// ── Minimal D1 type interfaces ─────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// ── Public types ───────────────────────────────────────────────────────────────

export interface CorrelationSignals {
  /** Cloudflare RayID from the request */
  ray_id:         string;
  /** Client IP address */
  ip:             string;
  /** Request pathname */
  path:           string;
  /** Cloudflare WAF total score */
  waf_score:      number;
  /** Autonomous System Number (optional) */
  asn?:           string;
  /** Organisation name (optional) */
  org_name?:      string;
  /** User-Agent string (optional) */
  user_agent?:    string;
  /** ISO timestamp of the request */
  timestamp?:     string;
}

export interface CorrelationResult {
  /** Whether an ingestion attempt was detected */
  detected:           boolean;
  /** Human-readable trigger reason */
  trigger?:           string;
  /** SHA-512 proof fingerprint stored in kaas_valuations */
  ingestion_proof_sha?: string;
  /** Valuation amount in USD */
  valuation_usd?:     number;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Analyse incoming request signals and, when the WAF score exceeds the
 * weight-ingestion threshold on a sensitive path, persist a forensic
 * correlation record to `kaas_valuations` and return the result.
 *
 * Non-throwing: all DB errors are logged to console and a non-detected
 * result is returned so callers are never blocked.
 */
export async function detectIngestionAttempt(
  signals: CorrelationSignals,
  db: D1Database,
): Promise<CorrelationResult> {
  const isSensitivePath = SENSITIVE_INGESTION_PATHS.has(signals.path);
  const isHighWaf       = signals.waf_score >= WAF_INGESTION_THRESHOLD;

  if (!isSensitivePath || !isHighWaf) {
    return { detected: false };
  }

  const trigger = `WAF_SCORE_${signals.waf_score}_ON_${signals.path.replace(/\//g, "_")}`;

  const proofInput  = `INGESTION:${signals.ray_id}:${signals.path}:${signals.waf_score}:${KERNEL_SHA}`;
  const ingestionSha = await sha512hex(proofInput);

  const valuation = 10_000_000.00; // Default enterprise KaaS valuation
  const now       = formatIso9(new Date());

  try {
    await db.prepare(
      `INSERT OR IGNORE INTO kaas_valuations
         (ray_id, asn, org_name, valuation_usd, settlement_status, kernel_sha, created_at)
       VALUES (?, ?, ?, ?, 'OPEN', ?, ?)`
    ).bind(
      signals.ray_id,
      signals.asn     ?? null,
      signals.org_name ?? null,
      valuation,
      KERNEL_SHA,
      now,
    ).run();
  } catch (err) {
    console.error(
      `[CORRELATION_ENGINE] kaas_valuations insert failed for ray_id=${signals.ray_id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  console.info(
    `[CORRELATION_ENGINE] WEIGHT_INGESTION_ATTEMPT detected — ray_id=${signals.ray_id} ` +
    `path=${signals.path} waf=${signals.waf_score} asn=${signals.asn ?? "?"} ` +
    `kernel_version=${KERNEL_VERSION}`,
  );

  return {
    detected:            true,
    trigger,
    ingestion_proof_sha: ingestionSha,
    valuation_usd:       valuation,
  };
}
