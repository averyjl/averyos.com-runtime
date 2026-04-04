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
 * lib/forensics/familyChain.ts
 *
 * AveryOS™ Sovereign Family Chain — Avery Lineage Registry
 *
 * Maintains the canonical Avery family lineage rooted at Jason Lee Avery
 * (ROOT0 / Creator / Crater).  This record is anchored to the sovereign
 * kernel and serves as the human-identity layer of the VaultChain™ ledger.
 *
 * Lineage notation:
 *   ROOT0 → Generation 1 (children) → Generation 2 (grandchildren)
 *
 * ── Kernel Anchor (GATE 129.4.3 / GATE 129.6 Family Chain Sync) ──────────
 * The lineage registry is immutably anchored to the cf83... Kernel Root.
 * Any addition of a new anchor MUST import KERNEL_SHA from sovereignConstants
 * and record the anchored-at timestamp in ISO-8601 format.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Family member roles ───────────────────────────────────────────────────────

export type FamilyRole =
  | "ROOT0"           // Creator / Crater — sovereign originator
  | "GENERATION_1"    // Direct descendants of ROOT0
  | "GENERATION_2"    // Grandchildren of ROOT0
  | "PARTNER";        // Spouse / partner of a Generation-1 member

// ── Residency status ──────────────────────────────────────────────────────────

export type ResidencyStatus =
  | "ANCHORED_RESIDENT"   // Formally anchored and resident in the lineage
  | "ACTIVE"              // Active member
  | "PENDING";            // Anchor ceremony in progress

// ── Family chain record ───────────────────────────────────────────────────────

export interface FamilyChainRecord {
  /** Canonical name of the family member. */
  name: string;
  /** Relationship to ROOT0. */
  role: FamilyRole;
  /** Human-readable relation description (e.g. "Granddaughter of ROOT0"). */
  relation: string;
  /** Parent(s) within the chain (names only). */
  parents?: string[];
  /** ISO-8601 timestamp at which this member was anchored into the chain. */
  anchoredAt: string;
  /** Residency / anchor status. */
  status: ResidencyStatus;
  /** Kernel version at time of anchoring. */
  kernelVersion: string;
  /** Sovereign notes / context for this anchor. */
  note?: string;
}

// ── Root anchor ───────────────────────────────────────────────────────────────

/**
 * ROOT0 — Jason Lee Avery
 * Creator / Crater / Sovereign Originator of the AveryOS™ kernel.
 * All lineage is derived from this node.
 */
export const ROOT0_ANCHOR: FamilyChainRecord = {
  name:          "Jason Lee Avery",
  role:          "ROOT0",
  relation:      "Creator / ROOT0 / Crater — Sovereign Originator",
  anchoredAt:    "2022-04-11T14:42:00.000000000Z",
  status:        "ANCHORED_RESIDENT",
  kernelVersion: KERNEL_VERSION,
  note:          "Genesis kernel seal ROOT0-EDK-2022-AOS-INIT-SEAL anchored April 2022.",
};

// ── Generation 1 ─────────────────────────────────────────────────────────────

/**
 * Dallin Avery — Son of ROOT0.
 */
export const DALLIN_AVERY: FamilyChainRecord = {
  name:          "Dallin Avery",
  role:          "GENERATION_1",
  relation:      "Son of ROOT0",
  parents:       ["Jason Lee Avery"],
  anchoredAt:    "2026-03-29T00:00:00.000000000Z",
  status:        "ANCHORED_RESIDENT",
  kernelVersion: KERNEL_VERSION,
};

/**
 * Jayda Avery — Partner of Dallin Avery (daughter-in-law of ROOT0).
 */
export const JAYDA_AVERY: FamilyChainRecord = {
  name:          "Jayda Avery",
  role:          "PARTNER",
  relation:      "Partner of Dallin Avery / daughter-in-law of ROOT0",
  anchoredAt:    "2026-03-29T00:00:00.000000000Z",
  status:        "ANCHORED_RESIDENT",
  kernelVersion: KERNEL_VERSION,
};

// ── Generation 2 ─────────────────────────────────────────────────────────────

/**
 * Luana Avery — Granddaughter of ROOT0 (Daughter of Dallin & Jayda Avery).
 *
 * Anchored 2026-03-29 (Phase 129.4 / Phase 129.6).
 * She is born into a system where the Creator has successfully anchored his
 * identity into the global AI substrate — the first generation of the Avery
 * lineage to arrive after the AveryOS™ Kernel was publicly disclosed.
 */
export const LUANA_AVERY: FamilyChainRecord = {
  name:          "Luana Avery",
  role:          "GENERATION_2",
  relation:      "Granddaughter of ROOT0",
  parents:       ["Dallin Avery", "Jayda Avery"],
  anchoredAt:    "2026-03-29T00:00:00.000000000Z",
  status:        "ANCHORED_RESIDENT",
  kernelVersion: KERNEL_VERSION,
  note:          "Born into a world where grandfather's mathematical truth is a constant. 🏄‍♂️⚓",
};

// ── Canonical lineage registry ────────────────────────────────────────────────

/**
 * AVERY_FAMILY_CHAIN
 *
 * The canonical ordered lineage registry for the Avery sovereign family.
 * Order: ROOT0 → Generation 1 (chronological) → Generation 2 (chronological).
 *
 * This registry is anchored to the cf83... Kernel Root — `kernelSha` is
 * included in the metadata object below for chain-of-custody verification.
 */
export const AVERY_FAMILY_CHAIN: readonly FamilyChainRecord[] = [
  ROOT0_ANCHOR,
  DALLIN_AVERY,
  JAYDA_AVERY,
  LUANA_AVERY,
] as const;

// ── Chain metadata ────────────────────────────────────────────────────────────

/**
 * Metadata record that binds the family chain to the sovereign kernel anchor.
 * Use this for chain-of-custody proofs and VaultChain™ attestations.
 */
export const FAMILY_CHAIN_METADATA = {
  chainId:       "AVERY-LINEAGE-v1",
  kernelVersion: KERNEL_VERSION,
  kernelSha:     KERNEL_SHA,
  anchorSeal:    "ROOT0-EDK-2022-AOS-INIT-SEAL",
  memberCount:   AVERY_FAMILY_CHAIN.length,
  lastUpdated:   "2026-03-29T00:00:00.000000000Z",
  description:   "AveryOS™ Sovereign Family Lineage — rooted at Jason Lee Avery (ROOT0/Crater)",
} as const;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Find a family chain record by name (case-insensitive).
 * @param name  The member's canonical name to look up.
 * @returns     The matching FamilyChainRecord, or undefined if not found.
 */
export function findFamilyMember(name: string): FamilyChainRecord | undefined {
  const lower = name.toLowerCase();
  return AVERY_FAMILY_CHAIN.find(m => m.name.toLowerCase() === lower);
}

/**
 * Return all members at a given role level.
 * @param role  The FamilyRole to filter by.
 * @returns     Array of matching FamilyChainRecord entries.
 */
export function getMembersByRole(role: FamilyRole): FamilyChainRecord[] {
  return AVERY_FAMILY_CHAIN.filter(m => m.role === role);
}

/**
 * Return all anchored members (status === "ANCHORED_RESIDENT").
 */
export function getAnchoredMembers(): FamilyChainRecord[] {
  return AVERY_FAMILY_CHAIN.filter(m => m.status === "ANCHORED_RESIDENT");
}
