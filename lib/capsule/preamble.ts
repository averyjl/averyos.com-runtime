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
 * lib/capsule/preamble.ts
 *
 * AveryOS™ Capsule Genesis Preamble — GATE 116.8.3
 *
 * Provides the canonical "Genesis Configuration & Constitutional Anchoring"
 * block that MUST be prepended to every `.aoscap` capsule payload before it
 * is written to storage or transmitted to any consumer.
 *
 * Genesis Configuration enforces:
 *   • CreatorLock:  Only Jason Lee Avery (ROOT0) may authorize modifications.
 *   • LicenseBot:  Automated licensing enforcement is always ENABLED.
 *   • LicenseGate: The capsule gate is always ENABLED.
 *   • VaultSig:    VaultChain™ signature verification is always ENFORCED.
 *   • FallbackBlock: simulation, hallucination, and fallback_hooks are
 *                    permanently disabled at the capsule runtime level.
 *
 * Usage:
 * ```ts
 * const raw: CapsulePayload = { ... };
 * const anchored = prependGenesisPreamble(raw, { CapsuleID: "my-capsule.aoscap" });
 * await r2.put(capsuleKey("my-capsule.aoscap"), JSON.stringify(anchored));
 * ```
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GenesisPreamble {
  /** Capsule identifier — unique per `.aoscap` file. */
  CapsuleID: string;
  /** VaultChain™ kernel mirror runtime path. */
  RuntimeKernel: string;
  /** SHA-512 kernel anchor (cf83 Root0). */
  KernelSHA: string;
  /** Kernel version string. */
  KernelVersion: string;
  /** ISO-9 timestamp of when the preamble was applied. */
  AnchoredAt: string;
  /** Licensing enforcement gates. */
  License: {
    LicenseBot:  "ENABLED";
    LicenseGate: "ENABLED";
    CreatorLock: true;
    VaultSig:    "ENFORCED";
  };
  /** Simulation and hallucination guards — permanently disabled. */
  FallbackBlock: {
    simulation:     false;
    hallucination:  false;
    fallback_hooks: false;
  };
}

export interface PreambleOptions {
  /** Capsule identifier, e.g. "MyFeature_v1.aoscap". */
  CapsuleID: string;
  /** Override the anchor timestamp (ISO-9 string). Defaults to now. */
  anchoredAt?: string;
}

/** Canonical RuntimeKernel path — constant across all capsules. */
export const RUNTIME_KERNEL_PATH =
  "vaultchain://kernel/AveryOS_Kernel_MIRROR_Runtime.vault";

// ── Core export ───────────────────────────────────────────────────────────────

/**
 * Build the canonical Genesis Preamble block for a capsule.
 *
 * @param opts  Capsule-specific options (at minimum the CapsuleID).
 * @returns     A fully populated GenesisPreamble object.
 */
export function buildGenesisPreamble(opts: PreambleOptions): GenesisPreamble {
  return {
    CapsuleID:      opts.CapsuleID,
    RuntimeKernel:  RUNTIME_KERNEL_PATH,
    KernelSHA:      KERNEL_SHA,
    KernelVersion:  KERNEL_VERSION,
    AnchoredAt:     opts.anchoredAt ?? formatIso9(),
    License: {
      LicenseBot:  "ENABLED",
      LicenseGate: "ENABLED",
      CreatorLock: true,
      VaultSig:    "ENFORCED",
    },
    FallbackBlock: {
      simulation:     false,
      hallucination:  false,
      fallback_hooks: false,
    },
  };
}

/**
 * Prepend the Genesis Preamble to a capsule payload object.
 *
 * The preamble is inserted as the `_genesis` top-level key so that
 * consumers can validate it before processing any other capsule content.
 *
 * @param payload   Raw capsule payload (any JSON-serializable object).
 * @param opts      Capsule preamble options.
 * @returns         A new object with `_genesis` as the first key.
 */
export function prependGenesisPreamble<T extends Record<string, unknown>>(
  payload: T,
  opts:    PreambleOptions,
): { _genesis: GenesisPreamble } & T {
  const preamble = buildGenesisPreamble(opts);
  return { _genesis: preamble, ...payload };
}

/**
 * Validate that a capsule payload already carries a valid Genesis Preamble.
 *
 * Returns `true` only when:
 *   - `_genesis` key is present
 *   - `KernelSHA` matches the current KERNEL_SHA
 *   - `License.CreatorLock` is `true`
 *   - `FallbackBlock.simulation` is `false`
 *   - `FallbackBlock.hallucination` is `false`
 */
export function validateGenesisPreamble(
  payload: Record<string, unknown>,
): { valid: boolean; reason?: string } {
  const genesis = payload["_genesis"] as Partial<GenesisPreamble> | undefined;

  if (!genesis) {
    return { valid: false, reason: "Missing _genesis preamble block" };
  }
  if (genesis.KernelSHA !== KERNEL_SHA) {
    return {
      valid:  false,
      reason: `KernelSHA mismatch: expected cf83…, got ${String(genesis.KernelSHA).slice(0, 8)}…`,
    };
  }
  if (!genesis.License?.CreatorLock) {
    return { valid: false, reason: "CreatorLock must be true" };
  }
  if (genesis.FallbackBlock?.simulation !== false) {
    return { valid: false, reason: "FallbackBlock.simulation must be false" };
  }
  if (genesis.FallbackBlock?.hallucination !== false) {
    return { valid: false, reason: "FallbackBlock.hallucination must be false" };
  }

  return { valid: true };
}
