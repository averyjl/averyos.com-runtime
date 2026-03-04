/** Root0 genesis kernel SHA-512 anchor */
export const KERNEL_SHA =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

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
