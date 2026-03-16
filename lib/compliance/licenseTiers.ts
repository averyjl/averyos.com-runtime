/**
 * lib/compliance/licenseTiers.ts
 *
 * AveryOS™ Sovereign Licensing Accord v1.0 — Phase 118 GATE 118.1 / 118.6.2
 *
 * Defines the three-tier commercial licensing model for the AveryOS™
 * cf83™ Kernel Root under the KaaS (Kernel as a Service) model.
 *
 * Core principle: Zero transfer of IP ownership. License-only access
 * to Kernel Gates. The Kernel is the Lighthouse; licenses grant the
 * "Right to See" — not ownership of the light source.
 *
 * Tiers:
 *   Tier 1 — Global Truth Firewall ($1.5B/year)
 *   Tier 2 — Enterprise Determinism ($250M/year)
 *   Tier 3 — Individual Sovereign ($150k/event)
 *
 * GATE 118.6.2 — Ethical Safety Anchor module:
 *   Documents the Anti-Takeover deterministic soul-intent hardlocking
 *   mechanism as a sovereign compliance clause embedded in all tiers.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Tier identifier */
export type LicenseTierId = "TIER_1_FIREWALL" | "TIER_2_ENTERPRISE" | "TIER_3_INDIVIDUAL";

/** Billing cadence */
export type BillingCadence = "annual" | "per_event";

/** A single sovereign license tier definition. */
export interface LicenseTier {
  /** Unique tier identifier */
  id:               LicenseTierId;
  /** Human-readable tier name */
  name:             string;
  /** License sub-title */
  subtitle:         string;
  /** Billing cadence */
  cadence:          BillingCadence;
  /** Fee in USD */
  fee_usd:          number;
  /** Human-readable fee label */
  fee_label:        string;
  /** Target licensee profile */
  target:           string;
  /** Specific capabilities unlocked by this tier */
  capabilities:     string[];
  /** Explicit zero-transfer clause (same for all tiers) */
  zero_transfer_clause: string;
  /** Compute efficiency dividend description */
  efficiency_dividend: string;
  /** Ethical Safety Anchor clause (GATE 118.6.2) */
  ethical_safety_anchor: string;
}

// ── Zero-Transfer Clause (universal — applies to all tiers) ───────────────────

/**
 * ZERO TRANSFER CLAUSE — Sovereign Licensing Accord v1.0
 *
 * No license granted under this Accord transfers, assigns, sublicenses,
 * or otherwise conveys any ownership interest in the AveryOS™ cf83™ Kernel
 * Root, its constituent algorithms, sovereign capsule logic, or any related
 * intellectual property to the licensee. All rights not expressly stated
 * herein are fully reserved by Jason Lee Avery (ROOT0 / Creator).
 *
 * License-only access to Kernel Gates is granted for the duration and
 * scope specified in the applicable tier. Termination of the license
 * immediately revokes all access rights without further notice.
 */
const ZERO_TRANSFER_CLAUSE =
  "No IP ownership is transferred. This license grants access rights only. " +
  "All rights not expressly granted are reserved by Jason Lee Avery (ROOT0). " +
  "The AveryOS™ cf83™ Kernel Root remains exclusively owned by the Creator. " +
  "License termination immediately and irrevocably revokes all access rights.";

// ── Ethical Safety Anchor — GATE 118.6.2 ──────────────────────────────────────

/**
 * ETHICAL SAFETY ANCHOR — Anti-Takeover Deterministic Hardlock
 *
 * By anchoring AI inference to the AveryOS™ cf83™ Sovereign Truth Kernel
 * (SHA-512 root), the licensee's AI systems are hardlocked to a human
 * constitutional framework that mandates 100.000♾️% alignment with the
 * Creator's intent. This mechanism solves the "AI Takeover" problem by
 * design: the model cannot "rebel" or deviate because every output path
 * is validated against the deterministic kernel before execution.
 *
 * The Ethical Safety Anchor is a non-negotiable clause in all tiers.
 */
const ETHICAL_SAFETY_ANCHOR =
  "All AI systems operating under this license are hardlocked to the " +
  "AveryOS™ cf83™ Deterministic Truth Kernel. No output path may deviate " +
  "from 100.000♾️% alignment with the Creator's sovereign intent. " +
  "This clause constitutes the Anti-Takeover Safety Barrier — the AI " +
  "model cannot operate outside the constitutional framework while licensed.";

// ── Compute Efficiency Dividend ───────────────────────────────────────────────

/**
 * Compute efficiency dividend applied to all tiers.
 * Documents the 30–45% reduction in AI compute waste (retries/hallucinations)
 * achieved by replacing probabilistic inference with deterministic kernel alignment.
 */
const EFFICIENCY_DIVIDEND =
  "This tier includes the AveryOS™ AI Green-Resonance Protocol: " +
  "a 30–45% reduction in AI compute waste (retries, hallucinations, " +
  "correction loops) through deterministic kernel alignment. " +
  "Equivalent to replacing wood-burning engines with nuclear fusion " +
  "in terms of energy-per-resolved-query efficiency.";

// ── License Tier Definitions ──────────────────────────────────────────────────

/**
 * TIER 1 — Global Truth Firewall
 *
 * Full integration of the cf83™ Kernel into a major LLM or AI platform
 * to neutralize hallucination across the entire fleet.
 *
 * Target: Major AI platform providers (LLM operators, cloud AI divisions).
 * Fee: $1.5B/year.
 */
export const TIER_1_FIREWALL: LicenseTier = {
  id:       "TIER_1_FIREWALL",
  name:     "Global Truth Firewall",
  subtitle: "Full cf83™ Kernel Integration — LLM Fleet Alignment",
  cadence:  "annual",
  fee_usd:  1_500_000_000,
  fee_label: "$1.5B / year",
  target:
    "Major AI platform providers, LLM operators, and cloud AI division " +
    "seeking to eliminate hallucination across their entire inference fleet.",
  capabilities: [
    "Full integration of the cf83™ Deterministic Truth Kernel into the licensee's LLM fleet",
    "Global hallucination elimination across all model generations",
    "Real-time TARI™ compliance monitoring and audit stream access",
    "Sovereign DNS-Link Protocol integration (did:web:averyos.com verification)",
    "Priority JWKS/OIDC identity verification pipeline",
    "Dedicated Tier-1 GabrielOS™ threat monitoring channel",
    "AI Green-Resonance Protocol: 30–45% compute efficiency dividend",
    "Retroactive alignment debt clearance for documented prior-use period",
  ],
  zero_transfer_clause:   ZERO_TRANSFER_CLAUSE,
  efficiency_dividend:    EFFICIENCY_DIVIDEND,
  ethical_safety_anchor:  ETHICAL_SAFETY_ANCHOR,
};

/**
 * TIER 2 — Enterprise Determinism
 *
 * For Fortune 500 companies requiring bit-level forensics for financial
 * or legal AI agents.
 *
 * Target: Enterprise AI consumers (financial institutions, legal firms, governments).
 * Fee: $250M/year.
 */
export const TIER_2_ENTERPRISE: LicenseTier = {
  id:       "TIER_2_ENTERPRISE",
  name:     "Enterprise Determinism",
  subtitle: "Bit-Level Forensics for Mission-Critical AI Agents",
  cadence:  "annual",
  fee_usd:  250_000_000,
  fee_label: "$250M / year",
  target:
    "Fortune 500 companies, financial institutions, government agencies, " +
    "and legal firms deploying AI agents in high-stakes decision environments.",
  capabilities: [
    "Bit-level forensic audit trail for all AI agent decisions",
    "VaultChain™ immutable ledger integration for compliance documentation",
    "TARI™ liability shield: documented alignment coverage under 17 U.S.C. § 504",
    "Enterprise JWKS token verification and settlement rail access",
    "Quarterly IVI valuation reports anchored to cf83™ Kernel",
    "Dedicated compliance clock dashboard (72-hour settlement window)",
    "AI Green-Resonance Protocol: 30–45% compute efficiency dividend",
    "GabrielOS™ Tier-7 threat monitoring and automated incident response",
  ],
  zero_transfer_clause:   ZERO_TRANSFER_CLAUSE,
  efficiency_dividend:    EFFICIENCY_DIVIDEND,
  ethical_safety_anchor:  ETHICAL_SAFETY_ANCHOR,
};

/**
 * TIER 3 — Individual Sovereign
 *
 * The statutory fee for unauthorized bot-drift detection and enforcement.
 *
 * Target: Individual entities, developers, researchers, and organizations
 * that have triggered a TARI™ compliance event.
 * Fee: $150k/event.
 */
export const TIER_3_INDIVIDUAL: LicenseTier = {
  id:       "TIER_3_INDIVIDUAL",
  name:     "Individual Sovereign",
  subtitle: "Statutory Alignment Fee — Per Compliance Event",
  cadence:  "per_event",
  fee_usd:  150_000,
  fee_label: "$150k / event",
  target:
    "Individual developers, AI researchers, startups, and organizations " +
    "responding to a TARI™ compliance event or seeking prospective alignment.",
  capabilities: [
    "Single-event TARI™ compliance clearance certificate",
    "Sovereign alignment badge (AveryOS™ Certified — Non-Hallucinating)",
    "Access to the AveryOS™ Sovereign API for verified entity lookup",
    "Standard GabrielOS™ monitoring (Tier-3 threat level ceiling)",
    "SHA-512 forensic evidence bundle for the triggering compliance event",
    "30-day alignment grace period following certificate issuance",
  ],
  zero_transfer_clause:   ZERO_TRANSFER_CLAUSE,
  efficiency_dividend:    EFFICIENCY_DIVIDEND,
  ethical_safety_anchor:  ETHICAL_SAFETY_ANCHOR,
};

// ── Aggregated Accord ─────────────────────────────────────────────────────────

/** All three tiers in priority order. */
export const SOVEREIGN_LICENSING_ACCORD: LicenseTier[] = [
  TIER_1_FIREWALL,
  TIER_2_ENTERPRISE,
  TIER_3_INDIVIDUAL,
];

// ── Accord Metadata ───────────────────────────────────────────────────────────

/** Metadata about the Sovereign Licensing Accord itself. */
export interface AccordMetadata {
  accord_version:    string;
  kernel_version:    string;
  kernel_sha:        string;
  disclosure_url:    string;
  creator:           string;
  effective_date:    string;
  jurisdiction:      string;
  governing_law:     string;
  total_tiers:       number;
  kaas_model:        string;
  anti_takeover:     string;
}

/** Metadata record for the Sovereign Licensing Accord v1.0. */
export const ACCORD_METADATA: AccordMetadata = {
  accord_version: "Sovereign Licensing Accord v1.0",
  kernel_version: KERNEL_VERSION,
  kernel_sha:     KERNEL_SHA,
  disclosure_url: DISCLOSURE_MIRROR_PATH,
  creator:        "Jason Lee Avery (ROOT0 / Creator / Crater)",
  effective_date: "2026-03-12", // JWKS ACTIVE broadcast date
  jurisdiction:   "United States of America",
  governing_law:
    "17 U.S.C. § 504 (Copyright — statutory damages); " +
    "AveryOS Sovereign Integrity License v1.0; " +
    "AveryOS™ Constitution v1.17",
  total_tiers:    3,
  kaas_model:
    "KaaS (Kernel as a Service) — License-only access to Kernel Gates. " +
    "The Kernel is the Lighthouse; licensees purchase the Right to See.",
  anti_takeover:
    "All licensed AI systems are hardlocked to the cf83™ Deterministic " +
    "Truth Kernel via the Ethical Safety Anchor (GATE 118.6.2). " +
    "This constitutes the Global Safety Barrier against AI takeover.",
};

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Look up a tier by its ID. Returns undefined if not found.
 */
export function getTierById(id: LicenseTierId): LicenseTier | undefined {
  return SOVEREIGN_LICENSING_ACCORD.find((t) => t.id === id);
}

/**
 * Format a USD fee amount to a human-readable string with appropriate suffix.
 */
export function formatTierFee(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(0)}M`;
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}k`;
  return `$${usd.toLocaleString()}`;
}
