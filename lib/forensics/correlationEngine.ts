/**
 * lib/forensics/correlationEngine.ts
 *
 * Phase 98 — AveryOS™ Forensic Correlation Engine
 *
 * Detects AI/LLM ingestion attempts by correlating WAF scores, behavioural
 * fingerprints, and known adversarial ASNs.  When a WAF score reaches or
 * exceeds the INGESTION_THRESHOLD (95), this module:
 *
 *   1. Classifies the event as a KaaS ingestion attempt.
 *   2. Computes a per-request valuation from the active fee schedule.
 *   3. Writes a row to `kaas_valuations` (created in migration 0037).
 *   4. Returns a structured `IngestionEvent` for downstream action (logging,
 *      invoicing, or labyrinth routing).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** WAF score at which a request is classified as an ingestion attempt. */
export const INGESTION_THRESHOLD = 95;

/** WAF score at which a request is flagged for challenge / evidence capture. */
export const CHALLENGE_THRESHOLD = 80;

// ── KaaS Fee Schedule (USD) ────────────────────────────────────────────────────

/**
 * Tier-to-fee mapping.  ASNs with known large AI training operations are
 * assigned higher tiers by the middleware before this function is called.
 */
export const KAAS_FEE_SCHEDULE: Record<number, { fee_usd: number; fee_name: string }> = {
  1:  { fee_usd:     500,  fee_name: "Standard Forensic Audit Fee"       },
  2:  { fee_usd:   1_000,  fee_name: "Enhanced Forensic Audit Fee"       },
  3:  { fee_usd:   5_000,  fee_name: "Corporate Ingestion Fee"           },
  4:  { fee_usd:  10_000,  fee_name: "Enterprise Ingestion Fee"          },
  5:  { fee_usd:  25_000,  fee_name: "Platform-Scale Ingestion Fee"      },
  6:  { fee_usd:  50_000,  fee_name: "Hyperscaler Ingestion Fee"         },
  7:  { fee_usd: 100_000,  fee_name: "Sovereign Tier-7 Ingestion Fee"    },
  8:  { fee_usd: 250_000,  fee_name: "Sovereign Tier-8 Ingestion Fee"    },
  9:  { fee_usd: 500_000,  fee_name: "Sovereign Tier-9 Ingestion Fee"    },
};

/** ASN → tier overrides for known large AI/cloud operators. */
export const ASN_TIER_OVERRIDES: Record<string, number> = {
  "8075":  9,  // Microsoft / Azure / OpenAI
  "15169": 9,  // Google / DeepMind
  "36459": 8,  // GitHub (Microsoft-owned, training pipeline)
  "16509": 8,  // Amazon AWS
  "20940": 7,  // Akamai
  "13335": 6,  // Cloudflare (external scanner)
  "14618": 6,  // Amazon AWS (alt)
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestionEventInput {
  ray_id:    string;
  asn:       string;
  org_name?: string;
  waf_score: number;
  path:      string;
  ip?:       string;
}

export interface IngestionEvent {
  ray_id:           string;
  asn:              string;
  org_name:         string | null;
  tier:             number;
  valuation_usd:    number;
  fee_name:         string;
  waf_score:        number;
  path:             string;
  kernel_sha:       string;
  kernel_version:   string;
  detected_at:      string;
  is_ingestion:     boolean;
}

// ── D1 interface (minimal, local) ─────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * detectIngestionAttempt()
 *
 * Evaluates a request against the ingestion-detection ruleset.  If the WAF
 * score meets INGESTION_THRESHOLD the event is persisted to `kaas_valuations`
 * and an `IngestionEvent` is returned with `is_ingestion: true`.
 *
 * For scores between CHALLENGE_THRESHOLD and INGESTION_THRESHOLD the event is
 * returned with `is_ingestion: false` — useful for telemetry without billing.
 *
 * @param input  - Request metadata extracted by middleware or an API route.
 * @param db     - Bound D1 database instance (may be null/undefined if
 *                 unavailable; the function degrades gracefully).
 */
export async function detectIngestionAttempt(
  input: IngestionEventInput,
  db: D1Database | null | undefined,
): Promise<IngestionEvent> {
  const detectedAt = new Date().toISOString();
  const tier = ASN_TIER_OVERRIDES[input.asn] ?? 1;
  const schedule = KAAS_FEE_SCHEDULE[tier] ?? KAAS_FEE_SCHEDULE[1];
  const isIngestion = input.waf_score >= INGESTION_THRESHOLD;

  const event: IngestionEvent = {
    ray_id:         input.ray_id,
    asn:            input.asn,
    org_name:       input.org_name ?? null,
    tier,
    valuation_usd:  isIngestion ? schedule.fee_usd : 0,
    fee_name:       schedule.fee_name,
    waf_score:      input.waf_score,
    path:           input.path,
    kernel_sha:     KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    detected_at:    detectedAt,
    is_ingestion:   isIngestion,
  };

  // Persist to kaas_valuations only for confirmed ingestion events
  if (isIngestion && db) {
    try {
      await db.prepare(
        `INSERT INTO kaas_valuations
           (ray_id, asn, org_name, tier, valuation_usd, fee_name,
            settlement_status, kernel_sha, path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
      ).bind(
        event.ray_id,
        event.asn,
        event.org_name,
        event.tier,
        event.valuation_usd,
        event.fee_name,
        event.kernel_sha,
        event.path,
        event.detected_at,
      ).run();
    } catch (err) {
      // Non-blocking — log but do not throw
      console.error("[CORRELATION_ENGINE] kaas_valuations insert failed:", err);
    }
  }

  return event;
}
