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
 * Capsule utility functions for VaultSig validation and SHA512 hash operations
 */

// SHA-512 hash regex: exactly 128 hexadecimal characters
export const SHA512_HEX_REGEX = /^[a-fA-F0-9]{128}$/;

/**
 * Validates a VaultSig SHA-512 hash
 * @param hash - The hash string to validate
 * @returns true if the hash is a valid 128-character SHA-512 hex string
 */
export function validateVaultSigHash(hash: string): boolean {
  if (!hash || typeof hash !== "string") {
    return false;
  }
  
  const normalized = hash.trim();
  return normalized.length === 128 && SHA512_HEX_REGEX.test(normalized);
}

/**
 * Normalizes a VaultSig hash by trimming whitespace
 * @param hash - The hash string to normalize
 * @returns The normalized hash string
 */
export function normalizeVaultSigHash(hash: string): string {
  return hash ? hash.trim() : "";
}

/**
 * Validates and normalizes a VaultSig hash
 * @param hash - The hash string to validate and normalize
 * @returns The normalized hash if valid, or null if invalid
 */
export function verifyVaultSigHash(hash: string): string | null {
  const normalized = normalizeVaultSigHash(hash);
  return validateVaultSigHash(normalized) ? normalized : null;
}
