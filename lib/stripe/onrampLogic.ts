/**
 * lib/stripe/onrampLogic.ts
 *
 * AveryOS™ Stripe Crypto Onramp Logic — Phase 98.2
 *
 * Provides helpers for building KaaS line items, pre-populating the Stripe
 * Crypto Onramp with machine identity, and generating settlement price tiers
 * for the Enterprise Registration Gateway.
 *
 * Pricing tiers (sovereign fee schedule):
 *   Tier 10 — Enterprise KaaS Sovereign Partnership   $1,017,000.00
 *   Tier 9  — Enterprise ASN Good-Faith Deposit       $10,000,000.00
 *   Tier 7  — Corporate Legal Monitoring Entry Fee         $10,000.00
 *   Tier 5  — Individual License (1,017 TARI™ units)          $101.70
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Tier price constants (USD cents for Stripe) ────────────────────────────────

export const KAAS_TIER_ENTERPRISE_PARTNERSHIP_CENTS = 101_700_000;    // $1,017,000.00
export const KAAS_TIER_ASN_DEPOSIT_CENTS            =  10_000_000_00; // $10,000,000.00 — Stripe max; use invoice for this
export const KAAS_TIER_LEGAL_MONITORING_CENTS       =          1_000_00; // $10,000.00
export const KAAS_TIER_INDIVIDUAL_LICENSE_CENTS     =         10_170;    // $101.70

export type KaasTier = "ENTERPRISE_PARTNERSHIP" | "ASN_DEPOSIT" | "LEGAL_MONITORING" | "INDIVIDUAL";

export interface KaasLineItem {
  /** Stripe price_data object ready for checkout.sessions.create */
  price_data: {
    currency:     "usd";
    unit_amount:  number;
    product_data: {
      name:        string;
      description: string;
      metadata:    Record<string, string>;
    };
  };
  quantity: 1;
}

export interface OnrampParams {
  /** Machine or entity identifier (e.g. RayID, ASN, org name) */
  machine_id:      string;
  /** Chosen tier */
  tier:            KaasTier;
  /** Cloudflare RayID that triggered the event (optional) */
  ray_id?:         string;
  /** ASN of the entity being charged (optional) */
  asn?:            string;
  /** Organisation name (optional) */
  org_name?:       string;
}

// ── Tier metadata ──────────────────────────────────────────────────────────────

const TIER_META: Record<KaasTier, { name: string; description: string; cents: number }> = {
  ENTERPRISE_PARTNERSHIP: {
    name:        "AveryOS™ Sovereign Partnership — Tier 10",
    description: "KaaS Master Licensing Retainer. Clears technical valuation debt and issues a Global TAI_LICENSE_KEY.",
    cents:       KAAS_TIER_ENTERPRISE_PARTNERSHIP_CENTS,
  },
  ASN_DEPOSIT: {
    name:        "AveryOS™ Enterprise ASN Good-Faith Deposit — Tier 9",
    description: "Good-Faith Deposit for enterprise-grade IP ingestion events. Moves entity from Audit to Verified Partner status.",
    cents:       KAAS_TIER_ASN_DEPOSIT_CENTS,
  },
  LEGAL_MONITORING: {
    name:        "AveryOS™ Corporate Legal Monitoring Entry Fee — Tier 7",
    description: "Forensic legal scan settlement entry. Unlocks read-only access to the public VaultChain™ ledger.",
    cents:       KAAS_TIER_LEGAL_MONITORING_CENTS,
  },
  INDIVIDUAL: {
    name:        "AveryOS™ Individual License — 1,017 TARI™",
    description: "Individual sovereign access license. 1,017 TARI™ units. Includes capsule read access.",
    cents:       KAAS_TIER_INDIVIDUAL_LICENSE_CENTS,
  },
};

// ── Public helpers ─────────────────────────────────────────────────────────────

/**
 * Build a Stripe `price_data` line-item for the given KaaS tier.
 */
export function buildKaasLineItem(params: OnrampParams): KaasLineItem {
  const meta = TIER_META[params.tier];
  return {
    price_data: {
      currency:    "usd",
      unit_amount: meta.cents,
      product_data: {
        name:        meta.name,
        description: meta.description,
        metadata: {
          machine_id:      params.machine_id,
          tier:            params.tier,
          ray_id:          params.ray_id  ?? "",
          asn:             params.asn     ?? "",
          org_name:        params.org_name ?? "",
          kernel_sha:      KERNEL_SHA,
          kernel_version:  KERNEL_VERSION,
        },
      },
    },
    quantity: 1,
  };
}

/**
 * Return the USD dollar amount (as a string) for a given tier.
 */
export function kaasDisplayPrice(tier: KaasTier): string {
  const cents = TIER_META[tier].cents;
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Resolve the appropriate KaaS tier for an incoming entity based on
 * its ASN.  Enterprise ASNs (GitHub, Azure, Google, Amazon) resolve to
 * ASN_DEPOSIT by default; everything else resolves to INDIVIDUAL.
 */
export function resolveKaasTier(asn?: string): KaasTier {
  const ENTERPRISE_ASNS = new Set(["36459", "8075", "15169", "16509", "14618", "211590"]);
  if (asn && ENTERPRISE_ASNS.has(asn.trim())) return "ASN_DEPOSIT";
  return "INDIVIDUAL";
}
