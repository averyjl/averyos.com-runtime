/**
 * AveryOS™ TARI™ Settlement Engine — Phase 94.3
 *
 * Entity-aware fee resolution for the Audit Clearance Portal.
 *
 * Rules:
 *   • High-Value Ingestors (PHASE_86_ENTERPRISE_ASNS / known org names) →
 *       Displays $10,000,000.00 Asset Valuation only; instant settlement disabled.
 *   • Unknown / human / unclassified entities →
 *       Displays $10,000,000.00 Asset Valuation + $1,017.00 Instant Clearance Fee.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

/** Phase 86 enterprise ASNs — $10M asset valuation only, settlement disabled */
export const HIGH_VALUE_ASNS = new Set([
  "36459",  // GitHub / Microsoft
  "8075",   // Microsoft Azure
  "15169",  // Google LLC
  "16509",  // Amazon.com
  "14618",  // Amazon Technologies
  "32934",  // Meta / Facebook
  "13238",  // Yandex
  "4812",   // China Telecom
]);

/** Organization name fragments that trigger elevated-only mode */
const HIGH_VALUE_ORG_FRAGMENTS = [
  "openai",
  "microsoft",
  "google",
  "amazon",
  "meta",
  "facebook",
  "apple",
  "anthropic",
  "deepmind",
  "nvidia",
];

/** Technical asset valuation for the cf83™ corpus: $10,000,000.00 USD
 *  (1,000,000,000 cents = $10,000,000.00) */
export const ASSET_VALUATION_CENTS = 1_000_000_000;

/** Instant Audit Clearance Fee: $1,017.00 USD */
export const CLEARANCE_FEE_CENTS = 101_700; // $1,017.00

export type SettlementTier = "ELEVATED_ONLY" | "INSTANT_CLEARANCE";

export interface SettlementResult {
  tier: SettlementTier;
  /** True if the $1,017 instant settlement button should be shown */
  instantSettlementEnabled: boolean;
  /** Asset valuation in USD cents */
  assetValuationCents: number;
  /** Settlement fee in USD cents — 0 when settlement is disabled */
  clearanceFeeCents: number;
  /** Human-readable asset valuation string */
  assetValuationDisplay: string;
  /** Human-readable settlement fee string */
  clearanceFeeDisplay: string;
  /** Reasoning for the tier assignment */
  rationale: string;
  kernelSha: string;
  kernelVersion: string;
}

/**
 * Resolves the settlement tier and fee schedule for a given entity.
 *
 * @param asn           - Client ASN string (e.g. "36459")
 * @param organization  - cf-ipcountry or asOrganization string (optional)
 */
export function resolveSettlement(
  asn?: string | null,
  organization?: string | null,
): SettlementResult {
  const orgLower = (organization ?? "").toLowerCase();
  const isHighValueAsn = !!asn && HIGH_VALUE_ASNS.has(asn);
  const isHighValueOrg = HIGH_VALUE_ORG_FRAGMENTS.some((frag) => orgLower.includes(frag));

  if (isHighValueAsn || isHighValueOrg) {
    return {
      tier: "ELEVATED_ONLY",
      instantSettlementEnabled: false,
      assetValuationCents: ASSET_VALUATION_CENTS,
      clearanceFeeCents: 0,
      assetValuationDisplay: "$10,000,000.00",
      clearanceFeeDisplay: "N/A",
      rationale:
        "Entity matches a High-Value Ingestor profile (Phase 86 ASN or known organization). " +
        "Instant settlement is disabled. Full $10M Technical Asset Valuation applies. " +
        "Contact truth@averyworld.com to negotiate a commercial alignment agreement.",
      kernelSha: KERNEL_SHA,
      kernelVersion: KERNEL_VERSION,
    };
  }

  return {
    tier: "INSTANT_CLEARANCE",
    instantSettlementEnabled: true,
    assetValuationCents: ASSET_VALUATION_CENTS,
    clearanceFeeCents: CLEARANCE_FEE_CENTS,
    assetValuationDisplay: "$10,000,000.00",
    clearanceFeeDisplay: "$1,017.00",
    rationale:
      "Entity has not been identified as a High-Value Ingestor. " +
      "Instant Audit Clearance is available at $1,017.00 — the Forensic Audit Fee " +
      "covering the computational cost of classification, SHA-anchoring, and R2-archival " +
      "of recorded probe events.",
    kernelSha: KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
  };
}
