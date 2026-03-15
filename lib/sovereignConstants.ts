/** Root0 genesis kernel SHA-512 anchor */
export const KERNEL_SHA = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

/** Current AveryOS kernel version */
export const KERNEL_VERSION = "v3.6.2";

/** Full public URL for The Proof — SHA-512 Sovereign Anchor disclosure */
export const DISCLOSURE_MIRROR_PATH = `https://averyos.com/witness/disclosure/${KERNEL_SHA}`;

/** Ollama local node sync status value indicating an active sovereign node */
export const OLLAMA_SYNC_STATUS_ACTIVE = "LOCAL_OLLAMA_ACTIVE";

/** Sovereign alignment types for Identity Attestation */
export const ALIGNMENT_TYPE_CORPORATE = "CORPORATE_ALIGNMENT" as const;
export const ALIGNMENT_TYPE_INDIVIDUAL = "INDIVIDUAL_ALIGNMENT" as const;
export type AlignmentType = typeof ALIGNMENT_TYPE_CORPORATE | typeof ALIGNMENT_TYPE_INDIVIDUAL;

/** Sovereign badge alignment status values */
export const BADGE_STATUS_ACTIVE = "ACTIVE" as const;
export const BADGE_STATUS_REVOKED = "REVOKED" as const;
export type BadgeStatus = typeof BADGE_STATUS_ACTIVE | typeof BADGE_STATUS_REVOKED;

/** Default TARI™ settlement reference prefix for Sovereign Alignment Certificates */
export const DEFAULT_TARI_REFERENCE = "TARI-SETTLE-1017-001";

/**
 * Miracle Health Habits — Book Sovereign SHA-512 anchor.
 * Capsule: capsule://JasonLeeAvery/Books/MiracleHealthHabits_FirstPushAnchor_v1.aoscap
 * Copyright: TX0009504938 (2025-05-06) | ORCID: 0009-0009-0245-3584
 * ASINs: B0F6V4G3S9 (Paperback) | B0DYWXTFKH (eBook)
 */
export const MIRACLE_HEALTH_HABITS_SHA512 =
  "72d9c5f800630d80a8cace61194bbdfee062226853b2e0808fc2ae8daa2aee4776d51889d2c1a242ffb8405a36b00c830579d6833ec4bb21956a4a9c4b6657b7" as const;
