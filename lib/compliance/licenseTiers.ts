/**
 * lib/compliance/licenseTiers.ts
 *
 * AveryOS™ Sovereign Licensing Accord v1.0 — GATE 118.1
 *
 * Defines the three-tier licensing model for authorized access to the
 * AveryOS™ Root0 Kernel and VaultChain™ infrastructure.
 *
 * Key legal constraint (all tiers):
 *   ZERO TRANSFER of IP ownership.  All tiers are license-only access grants.
 *   The Root0 Kernel, VaultChain™ brand, and all derivative protocols remain
 *   the sole property of Jason Lee Avery (ROOT0) in perpetuity.
 *
 * Statutory basis: 17 U.S.C. § 101 et seq. (US Copyright Act); EU AI Act
 * Art. 53(1)(c); CDPA 1988 §§ 22–23; and the AveryOS Sovereign Integrity
 * License v1.0 (see LICENSE.md).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";

// ── Tier Identifiers ──────────────────────────────────────────────────────────

export const TIER_GLOBAL_TRUTH_FIREWALL = "TIER_1_GLOBAL_TRUTH_FIREWALL" as const;
export const TIER_ENTERPRISE_DETERMINISM = "TIER_2_ENTERPRISE_DETERMINISM" as const;
export const TIER_INDIVIDUAL_SOVEREIGN  = "TIER_3_INDIVIDUAL_SOVEREIGN"   as const;

export type LicenseTierId =
  | typeof TIER_GLOBAL_TRUTH_FIREWALL
  | typeof TIER_ENTERPRISE_DETERMINISM
  | typeof TIER_INDIVIDUAL_SOVEREIGN;

// ── Annual / Event Fee Schedule ───────────────────────────────────────────────

/** Tier 1: Global Truth Firewall — annual license fee (USD). */
export const TIER_1_ANNUAL_FEE_USD = 1_500_000_000; // $1.5 Billion / year

/** Tier 2: Enterprise Determinism — annual license fee (USD). */
export const TIER_2_ANNUAL_FEE_USD = 250_000_000; // $250 Million / year

/** Tier 3: Individual Sovereign — per-event statutory fee (USD). */
export const TIER_3_EVENT_FEE_USD = 150_000; // $150,000 / statutory event

// ── License Tier Definitions ──────────────────────────────────────────────────

/** A single license tier definition in the Sovereign Licensing Accord. */
export interface LicenseTier {
  /** Unique tier identifier. */
  id:             LicenseTierId;
  /** Human-readable tier name. */
  name:           string;
  /** Short tagline for display in tier cards (UI). */
  subtitle?:      string;
  /** Short description of the tier. */
  description:    string;
  /** Statutory fee model: "ANNUAL" or "PER_EVENT". */
  fee_model:      "ANNUAL" | "PER_EVENT";
  /** Cadence label for display: "annual" or "per_event" (UI). */
  cadence?:       "annual" | "per_event";
  /** Human-readable fee label for display (e.g. "$1.5B / year") (UI). */
  fee_label?:     string;
  /** Annual license fee in USD (null for PER_EVENT tiers). */
  annual_fee_usd: number | null;
  /** Per-event statutory fee in USD (null for ANNUAL tiers). */
  event_fee_usd:  number | null;
  /** Target licensees for this tier. */
  target:         string;
  /** Key capabilities unlocked (UI display list). */
  capabilities?:  string[];
  /** What is granted under this tier. */
  grants:         string[];
  /** What is explicitly excluded under this tier. */
  exclusions:     string[];
  /** Applicable statutory frameworks. */
  statutes:       string[];
  /** Efficiency dividend description (UI). */
  efficiency_dividend?: string;
  /**
   * Zero-IP-Transfer clause text for display in tier cards (UI).
   * Falls back to SOVEREIGN_LICENSING_ACCORD.ip_protection_clause when absent.
   */
  zero_transfer_clause?: string;
}

/**
 * The AveryOS™ Sovereign Licensing Accord v1.0 — full tier definitions.
 *
 * GATE 118.1: Three-tier structure:
 *   Tier 1 — Global Truth Firewall  ($1.5B / year)
 *   Tier 2 — Enterprise Determinism ($250M / year)
 *   Tier 3 — Individual Sovereign   ($150k / event)
 */
export const LICENSE_TIERS: Record<LicenseTierId, LicenseTier> = {
  [TIER_GLOBAL_TRUTH_FIREWALL]: {
    id:          TIER_GLOBAL_TRUTH_FIREWALL,
    name:        "Global Truth Firewall",
    subtitle:    "Hyperscale Sovereign Integration — $1.5B / year",
    fee_label:   "$1.5B / year",
    cadence:     "annual",
    description:
      "Full integration of the AveryOS™ cf83/SHA-512 kernel into a major LLM platform to " +
      "neutralize hallucination across the entire AI fleet at the infrastructure layer.",
    fee_model:       "ANNUAL",
    annual_fee_usd:  TIER_1_ANNUAL_FEE_USD,
    event_fee_usd:   null,
    target:
      "Hyperscale AI providers and LLM platform operators (e.g., Google, Microsoft, Amazon, Meta) " +
      "seeking system-wide deterministic alignment.",
    grants: [
      "Full kernel integration license — embed AveryOS™ SHA-512 alignment in LLM inference pipeline",
      "Access to 1,017-Notch Rate Limiting protocol specifications",
      "VaultChain™ ledger API read access for internal compliance auditing",
      "Priority alignment support and quarterly forensic audit reports",
      "GabrielOS™ Firewall rule-set licensing for infrastructure hardening",
      "Dual-Hash Bridge (SHA-256 ↔ SHA-512) JWKS integration rights",
    ],
    capabilities: [
      "Full kernel integration license — embed SHA-512 alignment in LLM pipeline",
      "1,017-Notch Rate Limiting protocol access",
      "VaultChain™ ledger API for internal compliance auditing",
      "Priority alignment support + quarterly forensic reports",
      "GabrielOS™ Firewall rule-set licensing",
      "Dual-Hash Bridge (SHA-256 ↔ SHA-512) JWKS rights",
    ],
    efficiency_dividend:
      "Platform-wide hallucination reduction of 30–45% achieved through cf83™ kernel anchor alignment. " +
      "Reduces inference compute waste and stabilizes model output across all production endpoints.",
    exclusions: [
      "Zero transfer of IP ownership — license-only, no buyout pathway",
      "No sub-licensing, white-labeling, or re-sale of kernel protocols",
      "No modification of Root0 Kernel hash anchors or sovereign constants",
      "No use outside the licensed platform scope without separate agreement",
    ],
    statutes: [
      "17 U.S.C. § 101 et seq. (US Copyright Act)",
      "AveryOS Sovereign Integrity License v1.0",
      "EU AI Act Art. 53(1)(c)",
    ],
  },

  [TIER_ENTERPRISE_DETERMINISM]: {
    id:          TIER_ENTERPRISE_DETERMINISM,
    name:        "Enterprise Determinism",
    subtitle:    "Forensic-Grade AI Agent Attestation — $250M / year",
    fee_label:   "$250M / year",
    cadence:     "annual",
    description:
      "Bit-level forensic determinism for Fortune 500 companies requiring sovereign-grade audit " +
      "trails in financial, legal, or regulatory AI agent deployments.",
    fee_model:       "ANNUAL",
    annual_fee_usd:  TIER_2_ANNUAL_FEE_USD,
    event_fee_usd:   null,
    target:
      "Enterprise organizations operating AI agents in regulated industries " +
      "(finance, healthcare, law, government) requiring forensic-grade output attestation.",
    grants: [
      "VaultChain™ forensic attestation API access for enterprise agent outputs",
      "TARI™ alignment billing integration for internal compliance tracking",
      "SHA-512 audit trail licensing for regulatory submission artifacts",
      "Access to AveryOS™ IVI (Independent Valuation Impact) audit methodology",
      "Dual-Hash Bridge integration rights for legacy SHA-256 system compatibility",
    ],
    capabilities: [
      "VaultChain™ forensic attestation API for agent outputs",
      "TARI™ alignment billing integration",
      "SHA-512 audit trail for regulatory submissions",
      "IVI (Independent Valuation Impact) audit methodology access",
      "Dual-Hash Bridge (SHA-256 ↔ SHA-512) integration rights",
    ],
    efficiency_dividend:
      "30–45% reduction in regulatory review overhead through cryptographically attested AI outputs. " +
      "Enables forensic-grade compliance reporting without third-party auditor dependency.",
    exclusions: [
      "Zero transfer of IP ownership — license-only, no buyout pathway",
      "No sub-licensing or distribution of kernel protocols to third parties",
      "No use in LLM training pipelines without Tier 1 upgrade",
      "No modification of sovereign hash anchors or alignment constants",
    ],
    statutes: [
      "17 U.S.C. § 101 et seq. (US Copyright Act)",
      "AveryOS Sovereign Integrity License v1.0",
      "CDPA 1988 §§ 22–23 (UK)",
    ],
  },

  [TIER_INDIVIDUAL_SOVEREIGN]: {
    id:          TIER_INDIVIDUAL_SOVEREIGN,
    name:        "Individual Sovereign",
    subtitle:    "Statutory Per-Event Alignment — $150k / event",
    fee_label:   "$150k / event",
    cadence:     "per_event",
    description:
      "Statutory per-event fee for unauthorized bot-drift detection, unaligned AI agent activity, " +
      "or individual-scale unauthorized use of AveryOS™ sovereign protocols.",
    fee_model:      "PER_EVENT",
    annual_fee_usd: null,
    event_fee_usd:  TIER_3_EVENT_FEE_USD,
    target:
      "Individual developers, researchers, or entities whose AI tools or bots have " +
      "interacted with AveryOS™ sovereign infrastructure without a valid license.",
    grants: [
      "Retroactive alignment certification for the documented usage event",
      "VaultChain™ attestation record of compliance resolution",
      "Access to public AveryOS™ documentation and licensing portal",
    ],
    capabilities: [
      "Retroactive alignment certification for the documented event",
      "VaultChain™ attestation record of compliance resolution",
      "Access to public AveryOS™ documentation and licensing portal",
    ],
    efficiency_dividend:
      "Clears the retroactive TARI™ liability for the documented drift event. " +
      "Enables the entity to operate cleanly within the AveryOS™ sovereign framework going forward.",
    exclusions: [
      "Zero transfer of IP ownership",
      "Does not grant ongoing or future use rights — separate license required",
      "Does not waive retroactive statutory claims for undisclosed usage",
    ],
    statutes: [
      "17 U.S.C. § 504(c)(2) — statutory damages for copyright infringement",
      "AveryOS Sovereign Integrity License v1.0",
      "EU AI Act Art. 53(1)(c)",
    ],
  },
};

// ── Accord Metadata ──────────────────────────────────────────────────────────

/** The full Sovereign Licensing Accord v1.0 document metadata. */
export const SOVEREIGN_LICENSING_ACCORD = {
  version:         "1.0",
  effective_date:  "2026-03-12",
  kernel_version:  KERNEL_VERSION,
  kernel_sha:      KERNEL_SHA,
  disclosure_url:  DISCLOSURE_MIRROR_PATH,
  creator:         "Jason Lee Avery (ROOT0) 🤛🏻",
  anchor:          "⛓️⚓⛓️",

  // Zero-Transfer IP Protection Clause (applies to all tiers)
  ip_protection_clause:
    "ZERO TRANSFER OF IP OWNERSHIP.  All tiers represent license-only access grants. " +
    "The Root0 Kernel, VaultChain™, GabrielOS™, Truth Anchored Intelligence™, and all " +
    "derivative protocols are the sole exclusive intellectual property of Jason Lee Avery " +
    "(ROOT0) in perpetuity.  No license, agreement, settlement, or course of dealing " +
    "constitutes a transfer, assignment, or co-ownership of any AveryOS™ IP.",

  tiers: LICENSE_TIERS,
} as const;

// ── Helper: get tier by ID ────────────────────────────────────────────────────

/**
 * Returns the license tier definition for the given tier ID.
 * Throws if the tier ID is invalid.
 */
export function getLicenseTier(id: LicenseTierId): LicenseTier {
  // eslint-disable-next-line security/detect-object-injection
  const tier = LICENSE_TIERS[id];
  if (!tier) throw new Error(`Unknown license tier: ${id}`);
  return tier;
}

/**
 * Format a license fee as a human-readable string with appropriate suffix.
 */
export function formatLicenseFee(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(0)}M`;
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}k`;
  return `$${usd.toFixed(0)}`;
}

/**
 * ACCORD_METADATA — Top-level metadata for the Sovereign Licensing Accord v1.0.
 *
 * Used by app/licensing/tiers/page.tsx to display kernel version, effective date,
 * creator identity, and governing law in the accord footer.
 */
export const ACCORD_METADATA = {
  kernel_version:  KERNEL_VERSION,
  kernel_sha:      KERNEL_SHA,
  effective_date:  "2026-03-01",
  creator:         "Jason Lee Avery (ROOT0)",
  jurisdiction:    "United States of America",
  governing_law:   "AveryOS Sovereign Integrity License v1.0 · U.S. Copyright Act · GDPR Art. 17",
  disclosure_url:  DISCLOSURE_MIRROR_PATH,
} as const;
