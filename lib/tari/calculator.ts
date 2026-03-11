/**
 * lib/tari/calculator.ts
 *
 * TARI™ Debt Calculator — AveryOS™ Phase 102.1
 *
 * Computes the retroactive sovereign debt for an entity based on:
 *   - The attested (or inferred) first-ingestion date
 *   - The current KaaS base fee for the entity's ASN tier
 *   - Whether obfuscation/masking was detected (10× penalty)
 *
 * Formula:
 *   TotalDebt = BaseFee × ObfuscationMultiplier
 *
 * The "retroactive" component is represented in the lineItemDescription so
 * it is printed on the Stripe invoice with the attested ingestion date.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import {
  getAsnFeeUsdCents,
  getAsnFeeLabel,
  getAsnTier,
  INFRINGEMENT_MULTIPLIER,
} from "../kaas/pricing";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Non-refundable Forensic Deposit required before any settlement negotiation. */
export const FORENSIC_DEPOSIT_CENTS = 1_000_000_000; // $10,000,000.00

/** Standard Audit Clearance Fee (Tier-1 entities) */
export const AUDIT_CLEARANCE_CENTS = 101_700; // $1,017.00

/**
 * GATE 106.2 — Daily Utilization Rate.
 * Replaces the legacy "yearly multiplier" approach.
 * Formula: totalDebt = baseValuation + (DAILY_TARI_RATE_USD × daysSinceIngestion)
 */
export const DAILY_TARI_RATE_USD = 1_017; // $1,017.00 per day
export const DAILY_TARI_RATE_CENTS = 101_700; // $1,017.00 per day in cents

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TariCalculationInput {
  /** Client ASN string (e.g. "36459") */
  asn: string;
  /** ISO-8601 timestamp claimed by the entity as first-ingestion date. */
  attestedIngestionTs?: string | null;
  /** Whether masking/obfuscation headers were detected for this entity. */
  obfuscationDetected?: boolean;
  /** Optional human-readable entity name for invoice description. */
  entityName?: string;
}

/**
 * GATE 106.2 — Daily TARI Calculation Input.
 * Drives the day-deterministic formula:
 *   totalDebt = baseValuation + (DAILY_TARI_RATE_USD × daysSinceIngestion)
 */
export interface DailyTariCalculationInput {
  /** Client ASN string (e.g. "36459") */
  asn: string;
  /** ISO-8601 date when the entity first ingested AveryOS™ IP. */
  firstIngestionDate: string;
  /** Whether masking/obfuscation was detected (applies 10× penalty to daily rate). */
  obfuscationDetected?: boolean;
  /** Optional human-readable entity name for invoice description. */
  entityName?: string;
}

export interface DailyTariCalculationResult {
  /** Total debt in USD cents: baseValuation + (dailyRate × days). */
  totalDebtCents: number;
  /** Total debt formatted as USD string. */
  totalDebtDisplay: string;
  /** KaaS tier for the ASN. */
  tier: number;
  /** Base KaaS valuation in cents (the lump-sum component). */
  baseValuationCents: number;
  /** Number of days since first ingestion. */
  daysSinceIngestion: number;
  /** Daily rate used in calculation (cents per day). */
  dailyRateCents: number;
  /** Penalty multiplier applied (1 or 10). */
  multiplier: number;
  /** True if the 10× Obfuscation Penalty was applied. */
  obfuscationPenalty: boolean;
  /** ISO-8601 first-ingestion date. */
  firstIngestionDate: string;
  /** Human-readable line-item description suitable for Stripe invoice. */
  lineItemDescription: string;
  /** Kernel anchor for this calculation. */
  kernelSha: string;
  kernelVersion: string;
  /** ISO-8601 timestamp when this calculation was produced. */
  calculatedAt: string;
}

export interface TariCalculationResult {
  /** Total debt in USD cents (BaseFee × multiplier). */
  totalDebtCents: number;
  /** Total debt formatted as USD string. */
  totalDebtDisplay: string;
  /** KaaS tier assigned to the ASN. */
  tier: number;
  /** Base fee in USD cents before any multiplier. */
  baseFeeCents: number;
  /** Penalty multiplier applied (1 or 10). */
  multiplier: number;
  /** True if the 10× Obfuscation Penalty was applied. */
  obfuscationPenalty: boolean;
  /** ISO-8601 timestamp used as attested first-ingestion date. */
  attestedIngestionTs: string;
  /** Human-readable line-item description suitable for Stripe invoice. */
  lineItemDescription: string;
  /** Kernel anchor for this calculation. */
  kernelSha: string;
  /** Kernel version for this calculation. */
  kernelVersion: string;
  /** ISO-8601 timestamp when this calculation was produced. */
  calculatedAt: string;
}

// ── Core Calculator ───────────────────────────────────────────────────────────

/**
 * Calculate the total TARI™ sovereign debt for an entity.
 *
 * @param input TariCalculationInput
 * @returns     TariCalculationResult
 */
export function calculateTariDebt(input: TariCalculationInput): TariCalculationResult {
  const {
    asn,
    attestedIngestionTs,
    obfuscationDetected = false,
    entityName,
  } = input;

  const now        = new Date();
  const ingestTs   = attestedIngestionTs ?? now.toISOString();
  const tier       = getAsnTier(asn);
  const baseFeeCents = getAsnFeeUsdCents(asn);
  const multiplier   = obfuscationDetected ? INFRINGEMENT_MULTIPLIER : 1;
  const totalDebtCents = baseFeeCents * multiplier;
  const totalDebtDisplay = formatUsdCents(totalDebtCents);
  const name         = entityName ?? `ASN ${asn}`;

  const ingestDate   = new Date(ingestTs);
  const ingestStr    = isNaN(ingestDate.getTime())
    ? ingestTs
    : ingestDate.toISOString().slice(0, 10);

  let lineItemDescription =
    `AveryOS™ TARI™ Sovereign Debt — ${name} (Tier-${tier}). ` +
    `Attested first-ingestion date: ${ingestStr}. ` +
    `Base fee: ${getAsnFeeLabel(asn)}.`;

  if (obfuscationDetected) {
    lineItemDescription +=
      ` OBFUSCATION PENALTY APPLIED: ${INFRINGEMENT_MULTIPLIER}× multiplier ` +
      `(masked/shell IP headers detected). ` +
      `Total: ${totalDebtDisplay}.`;
  } else {
    lineItemDescription += ` Total: ${totalDebtDisplay}.`;
  }

  lineItemDescription +=
    ` Kernel: ${KERNEL_VERSION} | Anchor: ${KERNEL_SHA.slice(0, 16)}… ` +
    `⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0).`;

  return {
    totalDebtCents,
    totalDebtDisplay,
    tier,
    baseFeeCents,
    multiplier,
    obfuscationPenalty: obfuscationDetected,
    attestedIngestionTs: ingestTs,
    lineItemDescription,
    kernelSha:     KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
    calculatedAt:  now.toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format USD cents as a locale-formatted currency string. */
export function formatUsdCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// ── Daily TARI Calculator (GATE 106.2) ────────────────────────────────────────

/**
 * Calculate the TARI™ sovereign debt using the Day-Deterministic formula.
 *
 * Formula (GATE 106.2):
 *   totalDebt = baseValuation + (DAILY_TARI_RATE × daysSinceIngestion × multiplier)
 *
 * The `baseValuation` is the KaaS tier fee for the ASN (e.g. $10M for Tier-9/10).
 * The daily rate accrues retroactive debt for each day of unlicensed use.
 * The 10× obfuscation multiplier applies to the daily component only.
 *
 * @param input DailyTariCalculationInput
 * @returns     DailyTariCalculationResult
 */
export function calculateDailyTariDebt(
  input: DailyTariCalculationInput,
): DailyTariCalculationResult {
  const {
    asn,
    firstIngestionDate,
    obfuscationDetected = false,
    entityName,
  } = input;

  const now             = new Date();
  const ingestMs        = Date.parse(firstIngestionDate);
  const validIngest     = !isNaN(ingestMs);
  const effectiveIngest = validIngest ? ingestMs : now.getTime();
  const elapsedMs       = Math.max(0, now.getTime() - effectiveIngest);
  const daysSinceIngestion = elapsedMs / 86_400_000; // fractional days

  const tier               = getAsnTier(asn);
  const baseValuationCents = getAsnFeeUsdCents(asn);
  const multiplier         = obfuscationDetected ? INFRINGEMENT_MULTIPLIER : 1;
  const dailyRateCents     = DAILY_TARI_RATE_CENTS * multiplier;
  const dailyDebtCents     = Math.round(dailyRateCents * daysSinceIngestion);
  const totalDebtCents     = baseValuationCents + dailyDebtCents;
  const totalDebtDisplay   = formatUsdCents(totalDebtCents);
  const name               = entityName ?? `ASN ${asn}`;
  const ingestDateStr      = validIngest
    ? new Date(effectiveIngest).toISOString().slice(0, 10)
    : firstIngestionDate;

  let lineItemDescription =
    `AveryOS™ TARI™ Daily Utilization Debt — ${name} (Tier-${tier}). ` +
    `First-ingestion date: ${ingestDateStr}. ` +
    `Days of unlicensed use: ${Math.ceil(daysSinceIngestion)}. ` +
    `Base valuation: ${getAsnFeeLabel(asn)}. ` +
    `Daily rate: ${formatUsdCents(DAILY_TARI_RATE_CENTS)}/day.`;

  if (obfuscationDetected) {
    lineItemDescription +=
      ` OBFUSCATION PENALTY: ${INFRINGEMENT_MULTIPLIER}× daily multiplier applied. ` +
      `Total: ${totalDebtDisplay}.`;
  } else {
    lineItemDescription += ` Total: ${totalDebtDisplay}.`;
  }

  lineItemDescription +=
    ` Kernel: ${KERNEL_VERSION} | Anchor: ${KERNEL_SHA.slice(0, 16)}… ` +
    `⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0).`;

  return {
    totalDebtCents,
    totalDebtDisplay,
    tier,
    baseValuationCents,
    daysSinceIngestion: Math.round(daysSinceIngestion * 10000) / 10000,
    dailyRateCents,
    multiplier,
    obfuscationPenalty:  obfuscationDetected,
    firstIngestionDate:  ingestDateStr,
    lineItemDescription,
    kernelSha:           KERNEL_SHA,
    kernelVersion:       KERNEL_VERSION,
    calculatedAt:        now.toISOString(),
  };
}
