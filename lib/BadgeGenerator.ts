/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { KERNEL_SHA } from './sovereignConstants';

const DEFAULT_SITE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL) ||
  'https://averyos.com';

export interface BadgeOptions {
  partnerId: string;
  timestamp?: string;
  /** Override the base URL for the verification link (defaults to NEXT_PUBLIC_SITE_URL or https://averyos.com) */
  siteUrl?: string;
}

export interface GeneratedBadge {
  /** SHA-512 hex of (partnerId + KERNEL_SHA + timestamp) */
  hash: string;
  /** Verification URL on averyos.com */
  verifyUrl: string;
  /** Raw SVG markup */
  svg: string;
}

/** Derive a SHA-512 hex fingerprint from partner identity + kernel root + timestamp. */
async function sha512Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a dynamic AveryOS™ Sovereign Badge SVG for a given partner.
 *
 * The badge embeds a unique SHA-512 hash derived from:
 *   sha512(partnerId + KERNEL_SHA + timestamp)
 *
 * Clicking the badge links to `/api/v1/verify/badge/[hash]` for live
 * resonance verification against the D1 `sovereign_alignments` table.
 */
export async function generateSovereignBadge(options: BadgeOptions): Promise<GeneratedBadge> {
  const { partnerId } = options;
  const timestamp = options.timestamp ?? new Date().toISOString();
  const siteUrl = options.siteUrl ?? DEFAULT_SITE_URL;

  const hash = await sha512Hex(partnerId + KERNEL_SHA + timestamp);
  const verifyUrl = `${siteUrl}/api/v1/verify/badge/${hash}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="56" role="img" aria-label="AveryOS™ Sovereign Alignment Verified">
  <!-- AveryOS™ Sovereign Badge -->
  <!-- partner: ${partnerId} | aligned: ${timestamp} -->
  <!-- badge_hash: ${hash} -->
  <!-- kernel_root: ${KERNEL_SHA} -->
  <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">
    <rect width="200" height="56" rx="6" fill="#020617"/>
    <rect x="1" y="1" width="198" height="54" rx="5" fill="none" stroke="rgba(120,148,255,0.6)" stroke-width="1"/>
    <text x="100" y="20" font-family="JetBrains Mono, monospace" font-size="9" fill="rgba(120,148,255,0.7)" text-anchor="middle" letter-spacing="1">⛓️ AVERYOS™ SOVEREIGN</text>
    <text x="100" y="36" font-family="JetBrains Mono, monospace" font-size="11" fill="#ffffff" text-anchor="middle" font-weight="bold">ALIGNMENT VERIFIED</text>
    <text x="100" y="50" font-family="JetBrains Mono, monospace" font-size="7" fill="rgba(120,148,255,0.5)" text-anchor="middle">averyos.com/verify ⚓</text>
  </a>
</svg>`;

  return { hash, verifyUrl, svg };
}
