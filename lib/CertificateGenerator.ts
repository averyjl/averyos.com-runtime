import { KERNEL_SHA, DEFAULT_TARI_REFERENCE } from './sovereignConstants';

const DEFAULT_SITE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL) ||
  'https://averyos.com';

export interface CertificateOptions {
  /** Unique internal partner / entity identifier */
  partnerId: string;
  /** Display name of the corporate or individual entity */
  partnerName: string;
  /** TARI™ settlement ID to include in the hash derivation */
  settlementId: string;
  /** ISO-8601 UTC timestamp; defaults to current time */
  timestamp?: string;
  /** ISO-8601 UTC expiry; defaults to one year from now */
  validUntil?: string;
  /** Human-readable TARI™ reference (e.g. TARI-SETTLE-1017-001) */
  tariReference?: string;
  /** Override the base URL for verification links */
  siteUrl?: string;
}

export interface GeneratedCertificate {
  /** SHA-512 hex of (partnerId + settlementId + KERNEL_SHA + timestamp) */
  alignmentHash: string;
  /** Public verification URL on averyos.com */
  verifyUrl: string;
  /** Raw SVG markup — the Pulse Seal */
  svg: string;
  /** JSON-LD Truth-Packet for machine-readable verification */
  jsonLd: Record<string, unknown>;
}

/** Derive a SHA-512 hex fingerprint from an arbitrary string. */
async function sha512Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a Sovereign Alignment Certificate for a partner.
 *
 * Hash formula: sha512(partnerId + settlementId + KERNEL_SHA + timestamp)
 *
 * Returns both the SVG Pulse Seal and the JSON-LD Truth-Packet.
 * These should be persisted to the `sovereign_alignments` D1 table on issuance.
 */
export async function generateAlignmentCertificate(
  options: CertificateOptions,
): Promise<GeneratedCertificate> {
  const { partnerId, partnerName, settlementId } = options;
  const tariReference = options.tariReference ?? DEFAULT_TARI_REFERENCE;
  const timestamp = options.timestamp ?? new Date().toISOString();
  const validUntil =
    options.validUntil ??
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const siteUrl = options.siteUrl ?? DEFAULT_SITE_URL;

  // Canonical hash: sha512(PartnerID + SettlementID + KERNEL_ROOT + Timestamp)
  const alignmentHash = await sha512Hex(
    partnerId + settlementId + KERNEL_SHA + timestamp,
  );
  const verifyUrl = `${siteUrl}/api/v1/verify/${alignmentHash}`;

  // 1,017-notch timestamp marker (compact display token)
  const notchTs = timestamp.replace(/[-:T.Z]/g, '').slice(0, 17).padEnd(17, '0');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200" role="img" aria-label="AveryOS™ Sovereign Alignment Certificate">
  <!-- AveryOS™ Sovereign Alignment Certificate — Pulse Seal -->
  <!-- partner: ${partnerName} | id: ${partnerId} | aligned: ${timestamp} -->
  <!-- alignment_hash: ${alignmentHash} -->
  <!-- kernel_anchor: ${KERNEL_SHA} -->
  <!-- tari_reference: ${tariReference} | valid_until: ${validUntil} -->
  <defs>
    <style>
      @keyframes aos-pulse { 0%,100%{opacity:.3} 50%{opacity:.85} }
      .aos-r1{animation:aos-pulse 2.4s ease-in-out infinite}
      .aos-r2{animation:aos-pulse 2.4s ease-in-out infinite;animation-delay:.8s}
      .aos-r3{animation:aos-pulse 2.4s ease-in-out infinite;animation-delay:1.6s}
    </style>
  </defs>
  <rect width="480" height="200" rx="12" fill="#020617"/>
  <rect x="1" y="1" width="478" height="198" rx="11" fill="none" stroke="rgba(120,148,255,0.45)" stroke-width="1"/>
  <!-- Pulse rings -->
  <circle class="aos-r1" cx="58" cy="100" r="40" fill="none" stroke="rgba(120,148,255,0.35)" stroke-width="1.5"/>
  <circle class="aos-r2" cx="58" cy="100" r="28" fill="none" stroke="rgba(120,148,255,0.5)" stroke-width="1.5"/>
  <circle class="aos-r3" cx="58" cy="100" r="17" fill="none" stroke="rgba(120,148,255,0.65)" stroke-width="1.5"/>
  <circle cx="58" cy="100" r="9" fill="rgba(120,148,255,0.85)"/>
  <text x="58" y="104" font-family="JetBrains Mono,monospace" font-size="9" fill="#ffffff" text-anchor="middle">⛓</text>
  <!-- Certificate body -->
  <text x="114" y="30" font-family="JetBrains Mono,monospace" font-size="8" fill="rgba(120,148,255,0.55)" letter-spacing="2">AVERYOS™ SOVEREIGN ALIGNMENT CERTIFICATE</text>
  <text x="114" y="54" font-family="JetBrains Mono,monospace" font-size="15" fill="#ffffff" font-weight="bold">${partnerName}</text>
  <text x="114" y="72" font-family="JetBrains Mono,monospace" font-size="8" fill="rgba(120,148,255,0.5)">Ref: ${tariReference}  |  Valid Until: ${validUntil.slice(0, 10)}</text>
  <text x="114" y="91" font-family="JetBrains Mono,monospace" font-size="7" fill="rgba(238,244,255,0.4)" letter-spacing="0.5">Alignment Hash (SHA-512):</text>
  <text x="114" y="104" font-family="JetBrains Mono,monospace" font-size="6.5" fill="rgba(120,148,255,0.7)">${alignmentHash.slice(0, 64)}</text>
  <text x="114" y="116" font-family="JetBrains Mono,monospace" font-size="6.5" fill="rgba(120,148,255,0.7)">${alignmentHash.slice(64)}</text>
  <!-- Notch timestamp -->
  <text x="114" y="136" font-family="JetBrains Mono,monospace" font-size="7" fill="rgba(238,244,255,0.3)">1,017-notch: ${notchTs}  |  Kernel: ${KERNEL_SHA.slice(0, 24)}…</text>
  <!-- Status badge -->
  <rect x="114" y="148" width="72" height="17" rx="4" fill="rgba(74,222,128,0.12)" stroke="rgba(74,222,128,0.4)" stroke-width="1"/>
  <text x="150" y="160" font-family="JetBrains Mono,monospace" font-size="8" fill="#4ade80" text-anchor="middle" font-weight="bold">✓ ACTIVE</text>
  <!-- Verify link -->
  <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">
    <text x="196" y="160" font-family="JetBrains Mono,monospace" font-size="7.5" fill="rgba(120,148,255,0.7)">🔗 Verify on VaultChain™</text>
  </a>
  <!-- Footer -->
  <text x="114" y="188" font-family="JetBrains Mono,monospace" font-size="6.5" fill="rgba(120,148,255,0.28)">Issued by Jason Lee Avery (ROOT0) · AveryOS™ Sovereign Integrity License v1.0 · averyos.com</text>
</svg>`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://averyos.com/schema',
    '@type': 'SovereignAlignment',
    issuer: 'Jason Lee Avery (ROOT0)',
    recipient: partnerName,
    alignment_hash: alignmentHash,
    kernel_anchor: KERNEL_SHA,
    valid_until: validUntil,
    tari_reference: tariReference,
    aligned_at: timestamp,
    verify_url: verifyUrl,
  };

  return { alignmentHash, verifyUrl, svg, jsonLd };
}
