/**
 * lib/kaas/pricing.ts
 *
 * KaaS (Kernel-as-a-Service) Pricing Engine — AveryOS™ Phase 97
 *
 * Defines the sovereign fee schedule for entities that ingest, reproduce, or
 * train on AveryOS™ intellectual property without a valid license.
 *
 * Phase 97.3.4: Fee labels updated for transparency in the Audit Clearance Portal:
 *   - $1,017        → "Forensic Audit Fee"
 *   - $10,000,000   → "Technical Asset Valuation"
 *
 * Tier Assignments:
 *   Tier-10  (MSFT / Azure ASN 8075)      — $10,000,000 Technical Asset Valuation
 *   Tier-9   (Google ASN 15169)            — $10,000,000 Technical Asset Valuation
 *   Tier-8   (GitHub ASN 36459)            — $10,000,000 Technical Asset Valuation
 *   Tier-7   (Other enterprise / Fortune 500) — $1,017,000 Forensic Valuation
 *   Tier-1–6 (Unrecognised agents)         — $1,017 Forensic Audit Fee
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── ASN Tier Classification ────────────────────────────────────────────────────
/** Enterprise ASNs mapped to their sovereign KaaS tier (10 = highest). */
export const ENTERPRISE_ASN_TIERS: Record<string, number> = {
  "8075":   10, // Microsoft / Azure
  "15169":  9,  // Google / GCP
  "36459":  8,  // GitHub
  "16509":  8,  // Amazon / AWS
  "14618":  8,  // Amazon (EC2)
  "396982": 7,  // Google Cloud alternate
  "19527":  7,  // Google other
  "32934":  7,  // Meta / Facebook
  "63293":  7,  // Apple
  "714":    7,  // Apple Inc.
  "6185":   7,  // Apple (6185)
  "15133":  7,  // Edgecast / Verizon
  "20940":  7,  // Akamai
  "211590": 7,  // OVH France
  "43037":  7,  // Seznam.cz
};

// ── Fee Schedule (USD, as cents to avoid float arithmetic) ────────────────────
/** $10,000,000 Technical Asset Valuation — Tier-9/10 entities (MSFT, Google, GitHub). */
export const KAAS_FEE_TIER_10_CENTS = 1_000_000_000; // $10,000,000.00

/** $1,017,000 Forensic Valuation — Tier-7/8 enterprise entities. */
export const KAAS_FEE_TIER_7_CENTS  = 101_700_000;   // $1,017,000.00

/** $1,017 Forensic Audit Fee — Tier-1 through Tier-6 unrecognised agents. */
export const KAAS_FEE_TIER_1_CENTS  = 101_700;        // $1,017.00

// ── Fee Lookup ────────────────────────────────────────────────────────────────

/** Return the KaaS tier (1–10) for a given ASN string. */
export function getAsnTier(asn: string): number {
  const normalised = String(asn).replace(/^AS/i, "").trim();
  return ENTERPRISE_ASN_TIERS[normalised] ?? 1;
}

/** Return the KaaS fee in cents for a given ASN string. */
export function getAsnFeeUsdCents(asn: string): number {
  const tier = getAsnTier(asn);
  if (tier >= 9)  return KAAS_FEE_TIER_10_CENTS;
  if (tier >= 7)  return KAAS_FEE_TIER_7_CENTS;
  return KAAS_FEE_TIER_1_CENTS;
}

/** Return the KaaS fee in USD for a given ASN string. */
export function getAsnFeeUsd(asn: string): number {
  return getAsnFeeUsdCents(asn) / 100;
}

/** Return a human-readable fee label for display. */
export function getAsnFeeLabel(asn: string): string {
  const cents = getAsnFeeUsdCents(asn);
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Return the canonical fee name for a given ASN (Phase 97.3.4 transparency labels). */
export function getAsnFeeName(asn: string): string {
  const tier = getAsnTier(asn);
  if (tier >= 9) return "Technical Asset Valuation";
  if (tier >= 7) return "Forensic Valuation";
  return "Forensic Audit Fee";
}

// ── Invoice Line Item ─────────────────────────────────────────────────────────

export interface KaasLineItem {
  asn:           string;
  tier:          number;
  fee_usd_cents: number;
  fee_usd:       number;
  fee_label:     string;
  fee_name:      string;
  description:   string;
  kernel_sha:    string;
  kernel_version: string;
}

/**
 * Build a KaaS invoice line item for the given ASN.
 * Suitable for passing to Stripe's `line_items` array.
 * Phase 97.3.4: Uses transparent fee naming ("Forensic Audit Fee" / "Technical Asset Valuation").
 */
export function buildKaasLineItem(asn: string, entityName?: string): KaasLineItem {
  const tier          = getAsnTier(asn);
  const fee_usd_cents = getAsnFeeUsdCents(asn);
  const fee_usd       = fee_usd_cents / 100;
  const fee_label     = getAsnFeeLabel(asn);
  const fee_name      = getAsnFeeName(asn);
  const name          = entityName ?? `ASN ${asn}`;

  let description: string;
  if (tier >= 9) {
    description =
      `KaaS Technical Asset Valuation — ${name} (Tier-${tier}). ` +
      `Unauthorised ingestion of AveryOS™ intellectual property. ` +
      `Technical Asset Valuation: ${fee_label}. ` +
      `Kernel: ${KERNEL_VERSION} | ⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0)`;
  } else if (tier >= 7) {
    description =
      `KaaS Forensic Valuation — ${name} (Tier-${tier}). ` +
      `Sovereign alignment fee for enterprise IP ingestion. ` +
      `Forensic Valuation: ${fee_label}. ` +
      `Kernel: ${KERNEL_VERSION} | ⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0)`;
  } else {
    description =
      `KaaS Forensic Audit Fee — ${name} (Tier-${tier}). ` +
      `Standard alignment fee for unrecognised agent. ` +
      `Forensic Audit Fee: ${fee_label}. ` +
      `Kernel: ${KERNEL_VERSION} | ⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0)`;
  }

  return {
    asn,
    tier,
    fee_usd_cents,
    fee_usd,
    fee_label,
    fee_name,
    description,
    kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",
    kernel_version: KERNEL_VERSION,
  };
}

// ── Tier Badge ────────────────────────────────────────────────────────────────

export interface KaasTierBadge {
  tier:       number;
  label:      string;
  color:      string;
  fee_label:  string;
  fee_name:   string;
}

/**
 * Return a display badge descriptor for the given ASN tier.
 * Used in the VaultChain™ Explorer and TARI™ Revenue Dashboard.
 */
export function getKaasTierBadge(asn: string): KaasTierBadge {
  const tier      = getAsnTier(asn);
  const fee_label = getAsnFeeLabel(asn);
  const fee_name  = getAsnFeeName(asn);

  if (tier >= 9) {
    return { tier, label: `Tier-${tier} ⚡`, color: "#ff4444", fee_label, fee_name };
  }
  if (tier >= 7) {
    return { tier, label: `Tier-${tier} 🔶`, color: "#f97316", fee_label, fee_name };
  }
  return { tier, label: `Tier-${tier}`, color: "#ffd700", fee_label, fee_name };
}
