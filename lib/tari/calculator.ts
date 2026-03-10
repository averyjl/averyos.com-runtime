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
