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
 * CapsuleSigner — AveryOS™ Sovereign Capsule Integrity Utility
 *
 * Signs capsule payloads with:
 *   • The Root0 Anchor (KERNEL_SHA — cf83…da3e)
 *   • The current Bitcoin block height (fetched from the Blockstream API)
 *
 * The resulting CapsuleSignature object is stored alongside each capsule in D1
 * and included in time-locked download metadata so recipients can verify
 * provenance against the sovereign kernel.
 */

import { KERNEL_SHA } from "./sovereignConstants";

export interface CapsuleSignature {
  /** Root0 SHA-512 anchor (cf83…da3e) */
  root0Anchor: string;
  /** Bitcoin block height at time of signing */
  btcBlockHeight: number;
  /** ISO-8601 UTC timestamp of the signing event */
  signedAt: string;
  /** Combined fingerprint: SHA-512 hex of (root0Anchor + btcBlockHeight + capsuleId) */
  fingerprint: string;
}

/**
 * Fetches the current Bitcoin block height from the Blockstream API.
 * Returns 0 on failure (used as a sentinel value — does not invalidate the
 * signature; operators should note that 0 means "height unavailable at signing
 * time" rather than a genuine block 0).
 */
async function fetchBtcBlockHeight(): Promise<number> {
  try {
    const res = await fetch("https://blockstream.info/api/blocks/tip/height", {
      signal: AbortSignal.timeout(3000), // 3-second cap to avoid blocking uploads
    });
    if (!res.ok) return 0;
    const text = await res.text();
    const height = parseInt(text.trim(), 10);
    return Number.isFinite(height) ? height : 0;
  } catch {
    return 0;
  }
}

/**
 * Produces a SHA-512 fingerprint from an ASCII/UTF-8 string.
 * Uses the Web Crypto API (available in both Node.js ≥ 20 and Cloudflare Workers).
 */
async function sha512hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Signs a capsule and returns a CapsuleSignature.
 *
 * @param capsuleId  - The capsule's unique slug / identifier
 * @param capsuleContent - The raw string content of the .aoscap file (used for fingerprinting)
 */
export async function signCapsule(
  capsuleId: string,
  capsuleContent: string
): Promise<CapsuleSignature> {
  const [btcBlockHeight, contentHash] = await Promise.all([
    fetchBtcBlockHeight(),
    sha512hex(capsuleContent),
  ]);

  const signedAt = new Date().toISOString();

  // Fingerprint binds: Root0 anchor + BTC height + capsule content hash + capsule ID
  const fingerprintInput = [KERNEL_SHA, String(btcBlockHeight), contentHash, capsuleId].join("|");
  const fingerprint = await sha512hex(fingerprintInput);

  return {
    root0Anchor: KERNEL_SHA,
    btcBlockHeight,
    signedAt,
    fingerprint,
  };
}

/**
 * Verifies a CapsuleSignature against a capsule's content.
 * Returns true only when all fields match and the fingerprint is consistent.
 */
export async function verifyCapsuleSignature(
  capsuleId: string,
  capsuleContent: string,
  sig: CapsuleSignature
): Promise<boolean> {
  if (sig.root0Anchor !== KERNEL_SHA) return false;

  const contentHash = await sha512hex(capsuleContent);
  const fingerprintInput = [
    sig.root0Anchor,
    String(sig.btcBlockHeight),
    contentHash,
    capsuleId,
  ].join("|");
  const expectedFingerprint = await sha512hex(fingerprintInput);
  return expectedFingerprint === sig.fingerprint;
}
