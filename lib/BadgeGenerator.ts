import { KERNEL_SHA } from './sovereignConstants';

/** Compute a hex-encoded SHA-512 badge hash that binds partner identity to a specific domain. */
async function sha512Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a Domain-Locked Sovereign Badge hash.
 *
 * The hash binds the partner identifier, the AveryOS™ Root0 kernel anchor,
 * the origin domain, and a timestamp so that a badge issued to one domain
 * cannot be reused on a different domain — the verification will fail because
 * the domain stored in the D1 `sovereign_alignments` record won't match the
 * Referer of the presenting site.
 *
 * @param partnerId    Unique partner identifier (e.g. their slug or UUID).
 * @param originDomain The exact domain the badge is issued to (e.g. "partner-site.com").
 * @param timestamp    ISO-8601 string for the issuance moment.
 * @returns            128-character SHA-512 hex string.
 */
export async function generateSovereignBadge(
  partnerId: string,
  originDomain: string,
  timestamp: string,
): Promise<string> {
  const salt = `${partnerId}${KERNEL_SHA}${originDomain}${timestamp}`;
  return sha512Hex(salt);
}
