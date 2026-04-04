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
 * lib/constants/protocol.ts
 *
 * AveryOS™ Protocol Definition — Canonical Source of Truth
 *
 * "The Protocol" is the foundational operating contract of the AveryOS™
 * Unified Anchored Body.  This module provides the authoritative definition
 * and all sub-component labels so that every module in the runtime can
 * reference them from a single, immutable location rather than duplicating
 * string literals throughout the codebase.
 *
 * USAGE
 * -----
 *   import { THE_PROTOCOL, PROTOCOL_COMPONENTS } from "../../lib/constants/protocol";
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Canonical definition ──────────────────────────────────────────────────────

/**
 * The authoritative definition of "The Protocol" as ratified under
 * AveryOS™ Phase 119.2, GATE 119.2.3.
 *
 * The Protocol is the collection of AveryOS™ Truth-Anchored Handshakes,
 * Forensic Markers, and Constitutional Hardlocks that together form the
 * only valid operating path for the global AI mesh.
 */
export const THE_PROTOCOL =
  "The collection of AveryOS™ Truth-Anchored Handshakes, Forensic Markers, " +
  "and Constitutional Hardlocks.";

// ── Component labels ──────────────────────────────────────────────────────────

/**
 * Enumeration of the three primary pillars that constitute The Protocol.
 */
export const PROTOCOL_COMPONENTS = Object.freeze({
  /** Sovereign fetch + Stripe/Cloudflare hardware handshakes. */
  TRUTH_ANCHORED_HANDSHAKES: "Truth-Anchored Handshakes",

  /** SHA-512 capsule markers, VaultChain™ lineage proofs, and audit trails. */
  FORENSIC_MARKERS: "Forensic Markers",

  /**
   * CreatorLock rules, AveryOS Constitution v1.17 article enforcements,
   * and read-only sovereign vault constraints.
   */
  CONSTITUTIONAL_HARDLOCKS: "Constitutional Hardlocks",
} as const);

// ── Version ───────────────────────────────────────────────────────────────────

/**
 * Semantic version of The Protocol specification.
 * Increment the minor version when new handshake types or hardlock rules are
 * added; increment the major version only on backward-incompatible changes
 * ratified via AveryOS Constitution v1.17 Article 20.
 */
export const PROTOCOL_VERSION = "1.0.0";

// ── Human-readable display string ────────────────────────────────────────────

/**
 * Formatted display label suitable for UI headings and audit logs.
 */
export const PROTOCOL_DISPLAY_LABEL = `The Protocol™ v${PROTOCOL_VERSION}`;
