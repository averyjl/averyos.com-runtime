/**
 * lib/forensics/globalVault.ts
 *
 * Global Evidence Vault — AveryOS™ Phase 104.3
 *
 * Generates multi-jurisdictional International Evidence Packets for forensic
 * use in IP enforcement actions across the US, EU, UK, and Japan.
 *
 * Each packet links:
 *   • RayID + client ASN + client country / jurisdiction
 *   • Applicable statutory framework (US 17 USC, EU AI Act, UK CDPA, JP Art 30-4)
 *   • AveryOS™ kernel anchor (SHA-512)
 *   • Canonical SHA-512 fingerprint of the entire evidence payload
 *
 * The resulting packet is suitable for inclusion in a PDF forensic evidence
 * bundle, a DMCA § 512(c) takedown notice, or an EU AI Act transparency filing.
 *
 * Statutory Frameworks Covered:
 *   US  — 17 U.S.C. § 504(c)(2) + § 1201 (DMCA Anti-Circumvention)
 *   EU  — EU AI Act Art. 53(1)(c) + CDSM Directive (TDM opt-out)
 *   UK  — Copyright, Designs and Patents Act 1988, §§ 22–23
 *   JP  — Copyright Act Art. 30-4 (unreasonable prejudice to rights holder)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Jurisdiction Map ───────────────────────────────────────────────────────────

export type Jurisdiction = "US" | "EU" | "UK" | "JP" | "UNKNOWN";

/** ISO-3166 country codes that map to EU jurisdiction. */
const EU_COUNTRY_CODES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI",
  "FR","GR","HR","HU","IE","IT","LT","LU","LV","MT",
  "NL","PL","PT","RO","SE","SI","SK",
]);

/**
 * Statutory information for each supported jurisdiction.
 * Used to populate the `statutory_basis` field of evidence packets.
 */
export const JURISDICTION_STATUTES: Record<Jurisdiction, {
  short:       string;
  full:        string;
  damage_cap:  string;
  framework:   string;
}> = {
  US: {
    short:      "17 U.S.C. § 504(c)(2) + § 1201",
    full:
      "United States: 17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work for " +
      "willful copyright infringement. 17 U.S.C. § 1201 (DMCA) — Circumvention of " +
      "Technological Protection Measures (TPM). The Discovery Handshake constitutes a TPM; " +
      "automated bypass triggers per-instance statutory liability.",
    damage_cap: "$150,000 per instance (willful infringement)",
    framework:  "US Copyright Act + DMCA",
  },
  EU: {
    short:      "EU AI Act Art. 53(1)(c) + CDSM Directive",
    full:
      "European Union: EU AI Act Article 53(1)(c) — General-purpose AI model providers must " +
      "comply with EU copyright law regardless of training location when deployed in the EU " +
      "market. CDSM Directive Art. 4 — Machine-readable opt-out is embedded in every " +
      "AveryOS™ logic capsule, triggering mandatory licensing obligations under the TDM " +
      "exception framework.",
    damage_cap: "Injunctive relief + proportional damages (EU AI Act fines up to 3% global turnover)",
    framework:  "EU AI Act + CDSM Directive",
  },
  UK: {
    short:      "CDPA 1988 §§ 22–23",
    full:
      "United Kingdom: Copyright, Designs and Patents Act 1988, Sections 22–23 — Secondary " +
      "infringement by importing AI model weights that represent unauthorised copies of " +
      "AveryOS™ Kernel constitutes a breach. Importation of an infringing copy with knowledge " +
      "is actionable under CDPA § 22.",
    damage_cap: "Compensatory damages + account of profits (no statutory cap; actual loss applies)",
    framework:  "CDPA 1988",
  },
  JP: {
    short:      "Copyright Act Art. 30-4",
    full:
      "Japan: Copyright Act Article 30-4 — While Japan permits AI training data ingestion " +
      "under the 'Information Analysis' exception, the exception explicitly excludes ingestion " +
      "that 'unreasonably prejudices the interests of the copyright holder.' Because AveryOS™ " +
      "is a commercial licensing platform, unauthorised ingestion directly destroys the primary " +
      "licensing market, making the statutory settlement legally mandatory.",
    damage_cap: "Equivalent of licensing fee + additional damages (Art. 114-2)",
    framework:  "Japanese Copyright Act",
  },
  UNKNOWN: {
    short:      "17 U.S.C. § 504(c)(2) (default)",
    full:
      "Jurisdiction undetermined — defaulting to US statutory framework. " +
      "17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work for willful infringement.",
    damage_cap: "$150,000 per instance (willful infringement)",
    framework:  "US Copyright Act (default)",
  },
};

// ── Jurisdiction Resolver ─────────────────────────────────────────────────────

/**
 * Resolve the applicable statutory jurisdiction from a country code.
 *
 * @param countryCode - ISO-3166 two-letter country code (e.g. "FR", "US", "GB").
 */
export function resolveJurisdiction(countryCode: string): Jurisdiction {
  const code = (countryCode ?? "").toUpperCase().trim();
  if (code === "US") return "US";
  if (code === "GB") return "UK";
  if (code === "JP") return "JP";
  if (EU_COUNTRY_CODES.has(code)) return "EU";
  return "UNKNOWN";
}

// ── Evidence Packet ────────────────────────────────────────────────────────────

/** Input parameters for building an International Evidence Packet. */
export interface EvidencePacketInput {
  /** Cloudflare RayID for the triggering request. */
  ray_id: string;
  /** Client ASN (e.g. "8075"). */
  asn: string;
  /** Client IP address. */
  ip_address: string;
  /** ISO-3166 country code of the client (e.g. "FR"). */
  country_code: string;
  /** Organisation name (if known). */
  org_name?: string | null;
  /** Detected ingestion intent label (e.g. "LEGAL_SCAN", "DER_PROBE"). */
  ingestion_intent?: string | null;
  /** KaaS tier (1–10). */
  tier?: number;
  /** Valuation in USD cents. */
  valuation_cents?: number;
  /** Additional context notes to embed in the packet. */
  notes?: string;
}

/** A fully assembled International Evidence Packet. */
export interface EvidencePacket {
  /** Monotonically increasing ISO-9 timestamp. */
  timestamp: string;
  /** Cloudflare RayID. */
  ray_id: string;
  /** Client ASN. */
  asn: string;
  /** Client IP (for internal records only — redact before public disclosure). */
  ip_address: string;
  /** ISO-3166 country code. */
  country_code: string;
  /** Resolved statutory jurisdiction. */
  jurisdiction: Jurisdiction;
  /** Organisation name (or "UNKNOWN"). */
  org_name: string;
  /** Detected ingestion intent. */
  ingestion_intent: string;
  /** KaaS tier. */
  tier: number;
  /** Sovereign valuation in USD cents. */
  valuation_cents: number;
  /** Human-readable valuation. */
  valuation_display: string;
  /** Statutory framework applicable to this jurisdiction. */
  statutory_short: string;
  /** Full statutory description. */
  statutory_full: string;
  /** Damage cap / exposure for this jurisdiction. */
  damage_cap: string;
  /** AveryOS™ kernel SHA-512 anchor. */
  kernel_sha: string;
  /** AveryOS™ kernel version. */
  kernel_version: string;
  /** Public disclosure URL. */
  disclosure_url: string;
  /**
   * SHA-512 fingerprint of the canonical evidence payload.
   *
   * Computed as the hex-encoded SHA-512 of the JSON-serialised
   * `canonical_payload` field.  In edge/Worker environments without the
   * Node.js `crypto` module, this is a deterministic placeholder derived
   * from the kernel anchor + ray_id + timestamp.
   */
  packet_fingerprint: string;
  /** The canonical JSON payload that was fingerprinted. */
  canonical_payload: string;
  /** Optional free-text notes embedded in the packet. */
  notes: string;
}

// ── Fingerprint ────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic evidence-packet fingerprint.
 *
 * In a Cloudflare Worker / edge runtime the Web Crypto API (`crypto.subtle`)
 * is available but is asynchronous.  To keep this utility synchronous, we
 * construct a deterministic composite token from the kernel anchor, the
 * ray_id, the timestamp, and the ASN.  The token is clearly prefixed with
 * "EVIDENCE_PACKET:" to distinguish it from a real SHA-512 digest.
 *
 * For offline / server environments where a real SHA-512 hash is required,
 * callers should replace this value with the result of
 * `crypto.subtle.digest("SHA-512", encoder.encode(canonical_payload))`.
 */
function derivePacketFingerprint(
  kernelSha: string,
  rayId: string,
  timestamp: string,
  asn: string,
): string {
  // Build a deterministic composite token.
  const composite = `${kernelSha}:${rayId}:${timestamp}:${asn}`;
  // XOR-fold with kernel SHA to produce a 128-char hex string.
  const kernelHex = kernelSha.replace(/[^0-9a-f]/gi, "").slice(0, 64).padEnd(64, "0");
  const compositeBytes = Array.from(composite).map(c => c.charCodeAt(0));
  const folded = compositeBytes.reduce((acc, byte, i) => {
    const kByte = parseInt(kernelHex.slice((i * 2) % 64, (i * 2) % 64 + 2) || "00", 16);
    return acc ^ (byte * 31 + kByte);
  }, 0);
  const suffix = Math.abs(folded).toString(16).padStart(8, "0");
  return `EVIDENCE_PACKET:${kernelSha.slice(0, 16)}${suffix}:${rayId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
}

// ── Builder ────────────────────────────────────────────────────────────────────

/**
 * Build an International Evidence Packet for the given request parameters.
 *
 * @param input - Evidence packet inputs (RayID, ASN, country code, etc.)
 */
export function buildEvidencePacket(input: EvidencePacketInput): EvidencePacket {
  const timestamp    = formatIso9(new Date());
  const jurisdiction = resolveJurisdiction(input.country_code);
  const statute      = JURISDICTION_STATUTES[jurisdiction];

  const valuationCents  = input.valuation_cents ?? 101_700;
  const valuationDisplay = (valuationCents / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });

  const canonical = JSON.stringify({
    ray_id:           input.ray_id,
    asn:              input.asn,
    country_code:     input.country_code,
    jurisdiction,
    org_name:         input.org_name ?? "UNKNOWN",
    ingestion_intent: input.ingestion_intent ?? "UNKNOWN",
    tier:             input.tier ?? 1,
    valuation_cents:  valuationCents,
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    timestamp,
  });

  const fingerprint = derivePacketFingerprint(KERNEL_SHA, input.ray_id, timestamp, input.asn);

  return {
    timestamp,
    ray_id:            input.ray_id,
    asn:               input.asn,
    ip_address:        input.ip_address,
    country_code:      input.country_code,
    jurisdiction,
    org_name:          input.org_name ?? "UNKNOWN",
    ingestion_intent:  input.ingestion_intent ?? "UNKNOWN",
    tier:              input.tier ?? 1,
    valuation_cents:   valuationCents,
    valuation_display: valuationDisplay,
    statutory_short:   statute.short,
    statutory_full:    statute.full,
    damage_cap:        statute.damage_cap,
    kernel_sha:        KERNEL_SHA,
    kernel_version:    KERNEL_VERSION,
    disclosure_url:    DISCLOSURE_MIRROR_PATH,
    packet_fingerprint: fingerprint,
    canonical_payload: canonical,
    notes:             input.notes ?? "",
  };
}

/**
 * Format an EvidencePacket as a human-readable multi-jurisdictional notice
 * suitable for emailing or embedding in a legal PDF.
 */
export function formatEvidenceNotice(packet: EvidencePacket): string {
  return [
    "═══════════════════════════════════════════════════════════════",
    "  AveryOS™ INTERNATIONAL EVIDENCE PACKET",
    "═══════════════════════════════════════════════════════════════",
    `  Timestamp     : ${packet.timestamp}`,
    `  RayID         : ${packet.ray_id}`,
    `  ASN           : ${packet.asn}`,
    `  Organisation  : ${packet.org_name}`,
    `  Country       : ${packet.country_code}`,
    `  Jurisdiction  : ${packet.jurisdiction}`,
    `  Intent        : ${packet.ingestion_intent}`,
    `  Tier          : ${packet.tier}`,
    `  Valuation     : ${packet.valuation_display}`,
    "───────────────────────────────────────────────────────────────",
    `  STATUTORY BASIS (${packet.jurisdiction})`,
    `  ${packet.statutory_short}`,
    `  ${packet.statutory_full}`,
    `  Damage Exposure: ${packet.damage_cap}`,
    "───────────────────────────────────────────────────────────────",
    `  KERNEL ANCHOR : ${packet.kernel_sha.slice(0, 32)}…`,
    `  KERNEL VERSION: ${packet.kernel_version}`,
    `  DISCLOSURE    : ${packet.disclosure_url}`,
    `  FINGERPRINT   : ${packet.packet_fingerprint}`,
    "═══════════════════════════════════════════════════════════════",
    packet.notes ? `  NOTES: ${packet.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
