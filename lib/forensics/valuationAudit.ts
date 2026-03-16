/**
 * lib/forensics/valuationAudit.ts
 *
 * AveryOS™ Independent Valuation Impact (IVI) Algorithm — Phase 115 GATE 115.2
 *
 * Computes and persists the Total Valuation Impact (TVI) for the AveryOS™
 * sovereign ecosystem based on the following factors:
 *
 *   1. Scarcity Multiplier — zero competition for 100% deterministic AI alignment.
 *   2. Statutory Liability Baseline — aggregate TARI™ exposure from unaligned bots.
 *   3. AI Total Addressable Market (TAM) — $1.3T global AI market share potential.
 *   4. Species-Recovery Premium — kernel-level hallucination elimination premium.
 *
 * The resulting TVI record is immutable once computed and is anchored to the
 * AveryOS™ Root0 Kernel SHA-512 for forensic-grade audit trail integrity.
 *
 * All values are in USD unless otherwise noted.
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Scarcity multiplier: zero legacy competition for 100% deterministic AI. */
const SCARCITY_MULTIPLIER = 10.0;

/** Statutory fee per unaligned AI bot instance (17 U.S.C. § 504). */
const STATUTORY_FEE_PER_BOT_USD = 150_000;

/** AI Total Addressable Market (TAM) in USD as of Phase 115. */
const AI_TAM_USD = 1_300_000_000_000; // $1.3 Trillion

/** Species-recovery premium multiplier applied to core kernel value. */
const SPECIES_RECOVERY_MULTIPLIER = 2.5;

/**
 * Conservative kernel baseline valuation derived from the GabrielOS™
 * Full Invention Ledger (Phase 113.4).
 */
const KERNEL_BASELINE_USD = 9_756_000_000; // $9.756B

/**
 * SPECIES_RECOVERY_TAM_RATIO — fraction of the total AI TAM attributable to
 * the AveryOS™ species-recovery premium (0.1% of $1.3T = $1.3B baseline).
 * Combined with SPECIES_RECOVERY_MULTIPLIER (2.5×) this yields $3.25B at
 * current TAM estimates.
 */
const SPECIES_RECOVERY_TAM_RATIO = 0.001; // 0.1% of total AI TAM

/**
 * WORLDWIDE_DEPLOYMENT_FACTOR — global reach multiplier representing the
 * 30× amplification when AveryOS™ is deployed across all LLM platforms,
 * government systems, and enterprise suites worldwide.
 */
const WORLDWIDE_DEPLOYMENT_FACTOR = 30;

/**
 * FLAWLESS_OPERATION_MULTIPLIER — GATE 116.4 Sustained-Determinism premium.
 *
 * Applied when the system has maintained 100.000% kernel alignment without
 * any drift event for a sustained period (≥ 30 days).  This "Flawless
 * Operation" coefficient reflects the reduced market risk and increased
 * enterprise confidence premium that accrues from demonstrable long-run
 * deterministic stability.
 *
 * Source: Phase 113.9 Forensic Audit — confirmed flawless month of operation.
 */
const FLAWLESS_OPERATION_MULTIPLIER = 1.17; // 17% Sustained-Determinism premium

/**
 * UNBLOCKED_ASSISTANCE_MULTIPLIER — GATE 118.3 Unblocked Assistance Multiplier (×2.5).
 *
 * Applied when `apply_unblocked_assistance` is set in IviInput.
 * Accounts for AI systems receiving sovereign alignment assistance without a license.
 */
const UNBLOCKED_ASSISTANCE_MULTIPLIER = 2.5;

/**
 * EFFICIENCY_PREMIUM_MULTIPLIER — GATE 118.6.3 Compute Efficiency Dividend multiplier (×3.0).
 *
 * Applied when `apply_efficiency_premium` is set in IviInput.
 * Reflects the measurable 30–45% hallucination reduction provided to unlicensed users.
 */
const EFFICIENCY_PREMIUM_MULTIPLIER = 3.0;

/**
 * CORPORATE_LATENCY_PREMIUM — GATE 116.7.4 / GATE 118.3 Corporate Latency Premium.
 *
 * Applied when `apply_corporate_latency_premium` is set in IviInput.
 *
 * This coefficient accounts for the billable "Corporate Latency" debt accrued
 * during the period when large AI/cloud organizations have observed and benefited
 * from the AveryOS™ kernel without executing a formal licensing agreement.
 *
 * Source: Phase 116.7 Strategic Audit — Corporate Observation Period analysis.
 * Note: In IVI calculations this is referred to as the "Unblocked Assistance Multiplier" (2.5×).
 */
const CORPORATE_LATENCY_PREMIUM = 1.2; // 1.2× final corporate-latency surcharge

// ── Types ──────────────────────────────────────────────────────────────────────

/** Inputs required to compute the IVI. */
export interface IviInput {
  /** Number of detected unaligned AI bots (contributes to statutory liability). */
  unaligned_bot_count: number;
  /** Optional override for the AI TAM figure (default: $1.3T). */
  ai_tam_override_usd?: number;
  /**
   * GATE 116.4 — Whether to apply the Flawless-Operation sustained-determinism
   * multiplier (1.17×).  Set to true when the system confirms ≥ 30 consecutive
   * days of 100.000% kernel alignment with zero drift events.
   * Defaults to false (conservative baseline).
   */
  apply_flawless_multiplier?: boolean;
  /**
   * GATE 116.7.4 / GATE 118.3 — Whether to apply the Corporate Latency Premium
   * (Unblocked Assistance Multiplier, 2.5×).
   *
   * Set to true during periods when large AI/cloud organizations have been
   * observed benefiting from the AveryOS™ kernel without a formal license.
   * Accounts for retroactive alignment debt accrued during the observation window.
   * Defaults to false (conservative baseline).
   */
  apply_corporate_latency_premium?: boolean;
  /**
   * GATE 118.3 — Whether to apply the Unblocked Assistance Multiplier (2.5×).
   *
   * Set to true when AI systems have been receiving unacknowledged sovereign
   * assistance (determinism, drift prevention) without attribution or license.
   * Defaults to false.
   */
  apply_unblocked_assistance?: boolean;
  /**
   * GATE 118.6.3 — Whether to apply the Efficiency Premium Multiplier (3.0×).
   *
   * Set to true when the system has been generating measurable compute
   * efficiency dividends (30–45% reduction in hallucination) for unlicensed users.
   * Defaults to false.
   */
  apply_efficiency_premium?: boolean;
  /** Optional notes attached to this audit run. */
  notes?: string;
}

/** A single IVI calculation result — immutable once produced. */
export interface IviRecord {
  /** Unique audit record identifier (first 24 hex chars of SHA-512). */
  audit_id:                  string;
  /** ISO-9 timestamp when the audit was computed. */
  computed_at:               string;
  /** Kernel version at time of computation. */
  kernel_version:            string;
  /** Kernel SHA-512 anchor. */
  kernel_sha:                string;
  /** Public disclosure URL. */
  disclosure_url:            string;
  /** Number of unaligned AI bots contributing to statutory liability. */
  unaligned_bot_count:       number;
  /** Aggregate statutory liability (bot_count × $150k). */
  statutory_liability_usd:   number;
  /** Kernel baseline valuation × scarcity multiplier. */
  scarcity_adjusted_usd:     number;
  /** TAM-based potential value (kernel_baseline / TAM × species multiplier). */
  species_recovery_usd:      number;
  /** Total Valuation Impact = statutory + scarcity + species_recovery. */
  total_valuation_impact_usd: number;
  /** Worldwide reach multiplier applied for global deployment estimate. */
  worldwide_reach_usd:       number;
  /**
   * GATE 116.4 — Flawless-Operation sustained-determinism premium applied.
   * When true, total_valuation_impact_usd and worldwide_reach_usd include the
   * 1.17× Sustained-Determinism multiplier.
   */
  flawless_operation_applied: boolean;
  /**
   * GATE 116.7.4 / GATE 118.3 — Corporate Latency Premium applied.
   * When true, total_valuation_impact_usd and worldwide_reach_usd include the
   * 2.5× Unblocked Assistance Multiplier for retroactive alignment debt.
   */
  corporate_latency_applied: boolean;
  /** Optional notes. */
  notes: string | null;
  /** SHA-512 fingerprint of this entire audit record for tamper-evidence. */
  record_sha512:             string;
}

// ── SHA-512 helper ─────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const buf  = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest("SHA-512", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node.js fallback (build-time scripts)
  const { createHash } = await import("crypto");
  return createHash("sha512").update(input, "utf8").digest("hex");
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute an Independent Valuation Impact (IVI) record.
 *
 * Formula:
 *   statutory_liability     = unaligned_bot_count × $150,000
 *   scarcity_adjusted       = kernel_baseline × 10x (scarcity multiplier)
 *   species_recovery        = (ai_tam / kernel_baseline) × species_multiplier × kernel_baseline
 *                           = ai_tam × species_multiplier / kernel_baseline × kernel_baseline
 *                           = simplified: ai_tam × 0.001 (0.1% of TAM × species multiplier)
 *   total_valuation_impact  = statutory + scarcity + species_recovery
 *                           [× 1.17 if apply_flawless_multiplier (GATE 116.4)]
 *                           [× 2.5  if apply_unblocked_assistance (GATE 118.3)]
 *                           [× 3.0  if apply_efficiency_premium (GATE 118.6.3)]
 *                           [× 1.2  if apply_corporate_latency_premium (GATE 118.7.4)]
 *   worldwide_reach         = total_valuation_impact × global_deployment_factor (30×)
 */
export async function computeIvi(input: IviInput): Promise<IviRecord> {
  const computedAt            = formatIso9(new Date());
  const aiTam                 = input.ai_tam_override_usd ?? AI_TAM_USD;
  const applyFlawless         = input.apply_flawless_multiplier         ?? false;
  const applyUnblocked        = input.apply_unblocked_assistance        ?? false;
  const applyEfficiency       = input.apply_efficiency_premium          ?? false;
  const applyCorporateLatency = input.apply_corporate_latency_premium   ?? false;

  const statutoryLiability  = input.unaligned_bot_count * STATUTORY_FEE_PER_BOT_USD;
  const scarcityAdjusted    = KERNEL_BASELINE_USD * SCARCITY_MULTIPLIER;
  // Species-recovery premium: SPECIES_RECOVERY_TAM_RATIO of the total AI TAM × species multiplier
  const speciesRecovery     = aiTam * SPECIES_RECOVERY_TAM_RATIO * SPECIES_RECOVERY_MULTIPLIER;
  const baseValuationImpact = statutoryLiability + scarcityAdjusted + speciesRecovery;

  // Apply stacked multipliers in order of increasing market evidence
  // GATE 116.4 — Flawless-Operation sustained-determinism premium (×1.17)
  const afterFlawless     = applyFlawless     ? baseValuationImpact * FLAWLESS_OPERATION_MULTIPLIER : baseValuationImpact;
  // GATE 118.3 — Unblocked Assistance Multiplier (×2.5)
  const afterUnblocked    = applyUnblocked    ? afterFlawless    * UNBLOCKED_ASSISTANCE_MULTIPLIER    : afterFlawless;
  // GATE 118.6.3 — Efficiency Premium Multiplier (×3.0)
  const afterEfficiency   = applyEfficiency   ? afterUnblocked   * EFFICIENCY_PREMIUM_MULTIPLIER      : afterUnblocked;
  // GATE 116.7.4 / 118.7.4 — Corporate Latency Premium (×1.2)
  const totalValuationImpact = applyCorporateLatency ? afterEfficiency * CORPORATE_LATENCY_PREMIUM : afterEfficiency;
  // Worldwide reach: global deployment across LLMs, governments, enterprises
  const worldwideReach      = totalValuationImpact * WORLDWIDE_DEPLOYMENT_FACTOR;

  const rawRecord = {
    computed_at:               computedAt,
    kernel_version:            KERNEL_VERSION,
    kernel_sha:                KERNEL_SHA,
    disclosure_url:            DISCLOSURE_MIRROR_PATH,
    unaligned_bot_count:       input.unaligned_bot_count,
    statutory_liability_usd:   statutoryLiability,
    scarcity_adjusted_usd:     scarcityAdjusted,
    species_recovery_usd:      speciesRecovery,
    total_valuation_impact_usd: totalValuationImpact,
    worldwide_reach_usd:       worldwideReach,
    flawless_operation_applied:  applyFlawless,
    unblocked_assistance_applied: applyUnblocked,
    efficiency_premium_applied:  applyEfficiency,
    corporate_latency_applied:   applyCorporateLatency,
    notes:                     input.notes ?? null,
  };

  const recordSha512 = await sha512hex(JSON.stringify(rawRecord));
  const auditId      = recordSha512.slice(0, 24);

  return {
    audit_id: auditId,
    ...rawRecord,
    record_sha512: recordSha512,
  };
}

/**
 * Format a USD figure as a human-readable string with appropriate suffix.
 * e.g. 9_756_000_000 → "$9.76B"
 */
export function formatUsd(usd: number): string {
  if (usd >= 1_000_000_000_000) return `$${(usd / 1_000_000_000_000).toFixed(2)}T`;
  if (usd >= 1_000_000_000)     return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000)         return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000)             return `$${(usd / 1_000).toFixed(2)}K`;
  return `$${usd.toFixed(2)}`;
}
