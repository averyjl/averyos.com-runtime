/**
 * lib/tari/calculator.ts
 *
 * TARI™ Pricing Calculator — AveryOS™ Phase 102.1 / Gate 2
 *
 * Extends the KaaS pricing engine with date-range logic so that the
 * licensing fee can reflect the duration of usage when the usage start
 * date predates the current date.
 *
 * Rules:
 *   • Base fee is derived from lib/kaas/pricing.ts (ASN tier schedule).
 *   • If `usageStartDate` is provided and precedes today, a retroactive
 *     multiplier is applied: 1.0× per year of prior use, capped at 3.0×.
 *   • The minimum fee is always the base tier fee ($1,017 for Tier-1).
 *   • All cent arithmetic uses integer rounding to avoid float drift.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import {
  getAsnFeeUsdCents,
  getAsnTier,
  getAsnFeeLabel,
  buildKaasLineItem,
  type KaasLineItem,
} from "../kaas/pricing";
import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum retroactive multiplier (3× for 3+ years of prior use). */
const MAX_RETROACTIVE_MULTIPLIER = 3.0;

/** Milliseconds per year (non-leap approximation). */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TariCalculationInput {
  /** ASN string of the licensing entity (e.g. "36459"). */
  asn: string;
  /** Optional human-readable entity name for invoice descriptions. */
  entityName?: string;
  /**
   * ISO-8601 date string indicating when the entity's usage of AveryOS™ IP
   * began.  When this date precedes the current date, a retroactive multiplier
   * is applied to the base fee.  Omit or pass null to use the base fee only.
   */
  usageStartDate?: string | null;
}

export interface TariCalculationResult {
  asn: string;
  tier: number;
  baseFeeUsdCents: number;
  baseFeeUsd: number;
  baseFeeLabel: string;
  retroactiveMultiplier: number;
  priorUsageDays: number;
  totalFeeUsdCents: number;
  totalFeeUsd: number;
  totalFeeLabel: string;
  lineItem: KaasLineItem;
  kernelSha: string;
  kernelVersion: string;
  calculatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Compute the retroactive multiplier for a given usage start date.
 * Returns 1.0 if the date is in the future or not provided.
 * Applies an additional 1.0× for each full year of prior use:
 *   0–1 years  → 1.0×  (base only)
 *   1–2 years  → 2.0×  (base + 1 extra year)
 *   2–3 years  → 3.0×  (base + 2 extra years)
 * Caps at MAX_RETROACTIVE_MULTIPLIER.
 */
export function computeRetroactiveMultiplier(usageStartDate?: string | null): number {
  if (!usageStartDate) return 1.0;

  const start = new Date(usageStartDate);
  if (Number.isNaN(start.getTime())) return 1.0;

  const now = new Date();
  const elapsedMs = now.getTime() - start.getTime();
  if (elapsedMs <= 0) return 1.0;

  const elapsedYears = elapsedMs / MS_PER_YEAR;
  const multiplier = 1.0 + Math.floor(elapsedYears); // 1× per full year
  return Math.min(multiplier, MAX_RETROACTIVE_MULTIPLIER);
}

/**
 * Compute the number of calendar days between `usageStartDate` and now.
 * Returns 0 if the date is in the future or not provided.
 */
export function computePriorUsageDays(usageStartDate?: string | null): number {
  if (!usageStartDate) return 0;
  const start = new Date(usageStartDate);
  if (Number.isNaN(start.getTime())) return 0;
  const elapsedMs = Date.now() - start.getTime();
  return elapsedMs > 0 ? Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) : 0;
}

// ── Core calculator ────────────────────────────────────────────────────────────

/**
 * Calculate the total TARI™ licensing fee for the given entity.
 *
 * @param input - ASN, optional entity name, and optional usage start date.
 * @returns     Full calculation result including multiplier, totals, and a
 *              Stripe-ready KaasLineItem.
 */
export function calculateTariFee(input: TariCalculationInput): TariCalculationResult {
  const { asn, entityName, usageStartDate } = input;

  const tier            = getAsnTier(asn);
  const baseFeeUsdCents = getAsnFeeUsdCents(asn);
  const baseFeeUsd      = baseFeeUsdCents / 100;
  const baseFeeLabel    = getAsnFeeLabel(asn);

  const retroactiveMultiplier = computeRetroactiveMultiplier(usageStartDate);
  const priorUsageDays        = computePriorUsageDays(usageStartDate);

  const totalFeeUsdCents = Math.round(baseFeeUsdCents * retroactiveMultiplier);
  const totalFeeUsd      = totalFeeUsdCents / 100;
  const totalFeeLabel    = totalFeeUsd.toLocaleString("en-US", {
    style:    "currency",
    currency: "USD",
  });

  // Build a KaasLineItem for Stripe integration; the description reflects the
  // retroactive multiplier when prior usage is detected.
  const baseLineItem = buildKaasLineItem(asn, entityName);
  const lineItem: KaasLineItem = {
    ...baseLineItem,
    fee_usd_cents: totalFeeUsdCents,
    fee_usd:       totalFeeUsd,
    fee_label:     totalFeeLabel,
    description:
      retroactiveMultiplier > 1.0
        ? `${baseLineItem.description} Retroactive multiplier: ` +
          `${retroactiveMultiplier.toFixed(1)}× ` +
          `(${priorUsageDays} days of prior use). Total: ${totalFeeLabel}.`
        : baseLineItem.description,
  };

  return {
    asn,
    tier,
    baseFeeUsdCents,
    baseFeeUsd,
    baseFeeLabel,
    retroactiveMultiplier,
    priorUsageDays,
    totalFeeUsdCents,
    totalFeeUsd,
    totalFeeLabel,
    lineItem,
    kernelSha:     KERNEL_SHA.slice(0, 16) + "…",
    kernelVersion: KERNEL_VERSION,
    calculatedAt:  new Date().toISOString(),
  };
}
