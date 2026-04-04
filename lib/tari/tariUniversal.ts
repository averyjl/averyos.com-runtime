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
 * lib/tari/tariUniversal.ts
 *
 * TARI™ Universal v1.5 — Hardened Formula Constants
 *
 * Canonical constants derived from the AveryOS_TARI_Universal_v1.5.aoscap
 * capsule payload (Gate 10 — Sovereign Roadmap Phase 107.1).
 *
 * Capsule: AveryOS_TARI_Universal_v1.5.aoscap
 * Authority: Jason Lee Avery
 * Vault Anchor: vaultchain://capsule/AveryOS_Licensing_Statutory_v1.0.aoscap
 *
 * Retroactive Formula:
 *   Total = Base_Valuation
 *         + (Daily_Utilization_Rate × Days_Unlicensed)
 *         + (Statutory_Penalty × Instances)
 *
 * Statutory Basis: 17 U.S.C. § 504. $10M is the non-negotiable Technical
 * Asset Valuation as codified in AveryOS_TARI_Universal_v1.5.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Capsule-Hardened Constants ────────────────────────────────────────────────

/**
 * Non-negotiable Technical Asset Valuation (USD).
 * Source: AveryOS_TARI_Universal_v1.5.aoscap::TARI_Revenue_Logic.Base_Valuation
 */
export const TARI_BASE_VALUATION_USD = 10_000_000.00;

/**
 * Daily Utilization Rate (USD/day) — charged for each day the entity has
 * operated without a valid license.
 * Source: AveryOS_TARI_Universal_v1.5.aoscap::TARI_Revenue_Logic.Daily_Utilization_Rate
 */
export const TARI_DAILY_UTILIZATION_RATE_USD = 1_017.00;

/**
 * Statutory Penalty per infringement instance (USD).
 * Aligned with 17 U.S.C. § 504(c)(2) ($150,000 cap for willful infringement).
 * Source: AveryOS_TARI_Universal_v1.5.aoscap::TARI_Revenue_Logic.Statutory_Penalty
 */
export const TARI_STATUTORY_PENALTY_USD = 150_000.00;

/**
 * Obfuscation Multiplier applied to masked / anonymised entities.
 * Source: AveryOS_TARI_Universal_v1.5.aoscap::TARI_Revenue_Logic.Obfuscation_Multiplier
 */
export const TARI_OBFUSCATION_MULTIPLIER = 10.0;

// ── Capsule Seal ──────────────────────────────────────────────────────────────

/** SHA-512 fingerprint of AveryOS_TARI_Universal_v1.5.aoscap (truncated public seal). */
export const TARI_UNIVERSAL_V1_5_CAPSULE_SHA = "d28b27e0318a";

/** Vault anchor URI for this capsule. */
export const TARI_VAULT_ANCHOR =
  "vaultchain://capsule/AveryOS_Licensing_Statutory_v1.0.aoscap";

// ── Retroactive Debt Calculator ───────────────────────────────────────────────

export interface TariRetroactiveDebt {
  /** Base technical asset valuation (USD). */
  baseValuationUsd:   number;
  /** Daily utilization charge for unlicensed days (USD). */
  dailyChargeUsd:     number;
  /** Statutory penalty for counted infringement instances (USD). */
  statutoryPenaltyUsd: number;
  /** Total retroactive debt (USD, pre-obfuscation). */
  totalUsd:           number;
  /** Total retroactive debt with obfuscation multiplier applied (masked entities only). */
  totalObfuscatedUsd: number | null;
  /** Number of unlicensed days used in the calculation. */
  daysUnlicensed:     number;
  /** Number of infringement instances counted. */
  instances:          number;
  /** Whether the obfuscation multiplier was applied. */
  obfuscated:         boolean;
}

/**
 * Compute the TARI™ Universal v1.5 retroactive debt for an entity.
 *
 * Formula:
 *   Total = Base_Valuation
 *         + (Daily_Utilization_Rate × days_unlicensed)
 *         + (Statutory_Penalty × instances)
 *
 * @param daysUnlicensed  Number of days the entity operated without a license.
 * @param instances       Number of discrete infringement instances.
 * @param masked          Pass `true` to apply the 10× Obfuscation Multiplier.
 */
export function computeTariRetroactiveDebt(
  daysUnlicensed: number,
  instances:      number,
  masked          = false,
): TariRetroactiveDebt {
  const baseValuationUsd   = TARI_BASE_VALUATION_USD;
  const dailyChargeUsd     = TARI_DAILY_UTILIZATION_RATE_USD * Math.max(0, daysUnlicensed);
  const statutoryPenaltyUsd = TARI_STATUTORY_PENALTY_USD * Math.max(0, instances);
  const totalUsd           = baseValuationUsd + dailyChargeUsd + statutoryPenaltyUsd;
  const totalObfuscatedUsd = masked ? totalUsd * TARI_OBFUSCATION_MULTIPLIER : null;

  return {
    baseValuationUsd,
    dailyChargeUsd,
    statutoryPenaltyUsd,
    totalUsd,
    totalObfuscatedUsd,
    daysUnlicensed: Math.max(0, daysUnlicensed),
    instances:      Math.max(0, instances),
    obfuscated:     masked,
  };
}
