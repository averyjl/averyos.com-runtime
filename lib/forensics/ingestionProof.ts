/**
 * lib/forensics/ingestionProof.ts
 *
 * AveryOS™ Ingestion Proof — Phase 98.3
 *
 * Generates cryptographically anchored "Proof of Ingestion" certificates
 * that document AI weight-ingestion events for use in legal/Stripe review.
 *
 * Each certificate encodes:
 *   • RayID + kernel-SHA capsule touch timestamp
 *   • Entity ASN + org name
 *   • SHA-512 fingerprint of the entire proof payload
 *   • Sovereign valuation amount (default $10,000,000.00)
 *
 * The resulting certificate is suitable for inclusion in a Stripe statement
 * descriptor, a PDF Evidence Packet, or a DMCA notice.
 *
 * Author: Jason Lee Avery (ROOT0)
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";

// ── Public types ───────────────────────────────────────────────────────────────

export interface IngestionProofInput {
  /** Cloudflare RayID */
  ray_id:            string;
  /** Client IP address */
  ip:                string;
  /** Request path that was probed */
  path:              string;
  /** Cloudflare WAF total score at time of detection */
  waf_score:         number;
  /** Autonomous System Number of the entity */
  asn?:              string;
  /** Organisation name of the entity */
  org_name?:         string;
  /** User-Agent string */
  user_agent?:       string;
  /** ISO timestamp (defaults to now) */
  timestamp?:        string;
  /** Sovereign valuation in USD (defaults to $10,000,000) */
  valuation_usd?:    number;
}

export interface IngestionProofCertificate {
  /** Unique proof fingerprint (SHA-512 hex) */
  proof_sha512:      string;
  /** Kernel SHA-512 anchor */
  kernel_sha:        string;
  /** Kernel version */
  kernel_version:    string;
  /** Public disclosure URL */
  disclosure_url:    string;
  /** ISO-9 timestamp the certificate was generated */
  issued_at:         string;
  /** Entity RayID */
  ray_id:            string;
  /** Entity IP address */
  ip:                string;
  /** Probed path */
  path:              string;
  /** WAF score at detection */
  waf_score:         number;
  /** ASN (if known) */
  asn:               string | null;
  /** Org name (if known) */
  org_name:          string | null;
  /** Sovereign valuation in USD */
  valuation_usd:     number;
  /** Settlement status */
  settlement_status: "OPEN";
  /** Human-readable summary for legal packets */
  summary:           string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a Proof of Ingestion certificate for a detected AI weight-ingestion
 * event.  The returned certificate is self-contained and can be persisted to
 * D1, printed to a PDF, or included in a Stripe evidence packet.
 */
export async function generateIngestionProof(
  input: IngestionProofInput,
): Promise<IngestionProofCertificate> {
  const issuedAt     = formatIso9(new Date());
  const valuationUsd = input.valuation_usd ?? 10_000_000.00;

  const proofPayload = JSON.stringify({
    ray_id:       input.ray_id,
    ip:           input.ip,
    path:         input.path,
    waf_score:    input.waf_score,
    asn:          input.asn ?? null,
    org_name:     input.org_name ?? null,
    kernel_sha:   KERNEL_SHA,
    issued_at:    issuedAt,
    valuation_usd: valuationUsd,
  });

  const proofSha512 = await sha512hex(proofPayload);

  const summary = [
    `AveryOS™ Proof of Ingestion Certificate`,
    `Issued: ${issuedAt}`,
    `Entity: ${input.org_name ?? input.asn ?? input.ip}`,
    `RayID: ${input.ray_id}`,
    `Path: ${input.path}`,
    `WAF Score: ${input.waf_score}`,
    `Valuation: $${valuationUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD`,
    `Kernel: ${KERNEL_VERSION} (${KERNEL_SHA.slice(0, 16)}...)`,
    `Proof SHA-512: ${proofSha512.slice(0, 32)}...`,
    `Disclosure: ${DISCLOSURE_MIRROR_PATH}`,
  ].join("\n");

  return {
    proof_sha512:      proofSha512,
    kernel_sha:        KERNEL_SHA,
    kernel_version:    KERNEL_VERSION,
    disclosure_url:    DISCLOSURE_MIRROR_PATH,
    issued_at:         issuedAt,
    ray_id:            input.ray_id,
    ip:                input.ip,
    path:              input.path,
    waf_score:         input.waf_score,
    asn:               input.asn  ?? null,
    org_name:          input.org_name ?? null,
    valuation_usd:     valuationUsd,
    settlement_status: "OPEN",
    summary,
  };
}
