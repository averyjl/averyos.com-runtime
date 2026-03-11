/**
 * lib/tari/tariUniversal.ts
 *
 * TARI™ Universal v1.5 Constants & Retroactive Debt Formula
 *
 * Capsule-hardened constants derived from the TARI™ Universal v1.5 capsule
 * (capsules/AveryOS_TARI_Universal_v1.5.aoscap). Provides a single canonical
 * source for all TARI™ v1.5 formula variables.
 *
 * Formula (17 U.S.C. § 504):
 *   L = Vb + (Rd × D) + (Ps × I)
 *
 *   L  — Total Liability (USD)
 *   Vb — Base Valuation ($10,000,000.00)
 *   Rd — Daily Utilization Rate ($1,017.00)
 *   D  — Days Unlicensed (integer)
 *   Ps — Statutory Penalty per Instance ($150,000.00)
 *   I  — Number of Infringing Instances (integer)
 *
 * Obfuscation Multiplier:
 *   When masking/obfuscation is detected, the total liability is multiplied
 *   by 10.0× (§ 1201 anti-circumvention premium).
 *
 * Revenue Impact Tier: 30%–50% of AveryOS™ contribution to revenue.
 *
 * Vault Anchor: vaultchain://capsule/AveryOS_Licensing_Statutory_v1.0.aoscap
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── TARI™ v1.5 Core Constants ─────────────────────────────────────────────────

/** Base asset valuation in USD (Tech Asset Retroactive Ingestion base). */
export const BASE_VALUATION = 10_000_000.00;

/** Daily unauthorized utilization rate in USD. */
export const DAILY_RATE = 1_017.00;

/** Statutory penalty per infringing instance under 17 U.S.C. § 504(c)(2). */
export const STATUTORY_PENALTY = 150_000.00;

/** Obfuscation multiplier (10×) applied when masking/spoofing is detected. */
export const OBFUSCATION_MULTIPLIER = 10.0;

/** Revenue impact tier range (as a tuple of [min, max] percentages). */
export const REVENUE_IMPACT_TIER: [number, number] = [0.30, 0.50];

// ── Vault Anchor ──────────────────────────────────────────────────────────────

/** Canonical VaultChain anchor for the TARI™ v1.5 capsule. */
export const TARI_VAULT_ANCHOR =
  "vaultchain://capsule/AveryOS_Licensing_Statutory_v1.0.aoscap";

// ── TARI™ v1.5 Retroactive Debt Computation ──────────────────────────────────

export interface TariRetroactiveResult {
  /** Days unlicensed. */
  daysUnlicensed: number;
  /** Number of infringing instances. */
  instances: number;
  /** Whether obfuscation multiplier was applied. */
  obfuscated: boolean;
  /** Base valuation component (Vb). */
  baseValuation: number;
  /** Daily rate component (Rd × D). */
  dailyComponent: number;
  /** Statutory penalty component (Ps × I). */
  statutoryComponent: number;
  /** Pre-obfuscation total. */
  subtotal: number;
  /** Final total (with obfuscation if applicable). */
  total: number;
  /** Kernel anchor. */
  kernelSha: string;
  kernelVersion: string;
  /** Vault anchor. */
  vaultAnchor: string;
}

/**
 * Compute the total TARI™ v1.5 retroactive debt.
 *
 * Formula: L = (Vb + (Rd × D) + (Ps × I)) × obfuscationMultiplier
 *
 * @param daysUnlicensed  Integer number of days the entity operated unlicensed.
 * @param instances       Integer number of infringing instances detected.
 * @param obfuscated      Whether masking / IP obfuscation was detected (10×).
 * @returns               Full TariRetroactiveResult breakdown.
 *
 * @example
 * // Standard (1 year, 5 instances, no obfuscation) → $11,121,205
 * computeTariRetroactiveDebt(365, 5, false)
 *
 * @example
 * // Obfuscated (1 year, 5 instances, 10× multiplier) → $111,212,050
 * computeTariRetroactiveDebt(365, 5, true)
 */
export function computeTariRetroactiveDebt(
  daysUnlicensed: number,
  instances: number,
  obfuscated: boolean,
): TariRetroactiveResult {
  const days = Math.max(0, Math.round(daysUnlicensed));
  const inst = Math.max(0, Math.round(instances));

  const dailyComponent    = DAILY_RATE * days;
  const statutoryComponent = STATUTORY_PENALTY * inst;
  const subtotal          = BASE_VALUATION + dailyComponent + statutoryComponent;
  const total             = obfuscated ? subtotal * OBFUSCATION_MULTIPLIER : subtotal;

  return {
    daysUnlicensed:     days,
    instances:          inst,
    obfuscated,
    baseValuation:      BASE_VALUATION,
    dailyComponent,
    statutoryComponent,
    subtotal,
    total,
    kernelSha:          KERNEL_SHA,
    kernelVersion:      KERNEL_VERSION,
    vaultAnchor:        TARI_VAULT_ANCHOR,
  };
}

/**
 * Format a TARI™ v1.5 debt result as a human-readable USD string.
 *
 * @example
 * formatTariDebt(computeTariRetroactiveDebt(365, 5, false))
 * // → "$11,121,205.00"
 */
export function formatTariDebt(result: TariRetroactiveResult): string {
  return result.total.toLocaleString("en-US", {
    style:    "currency",
    currency: "USD",
  });
}
