/**
 * lib/forensics/ingestionProof.ts
 *
 * Phase 98 — AveryOS™ Ingestion Proof Generator
 *
 * Produces SHA-512-anchored legal certificates for confirmed AI/LLM ingestion
 * events detected by the correlation engine.  Each certificate binds:
 *
 *   - The sovereign kernel SHA (v3.6.2 anchor)
 *   - The originating RayID and ASN
 *   - The request path and timestamp
 *   - A computed valuation for KaaS billing
 *
 * Certificates are structured as JSON and can be stored in R2, returned via
 * API, or attached to Stripe invoices as evidence bundles.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../sovereignConstants";
import type { IngestionEvent } from "./correlationEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestionProof {
  /** Unique certificate identifier (SHA-512 of the full payload). */
  proof_id:           string;
  /** Canonical sovereign kernel anchor. */
  kernel_sha:         string;
  /** AveryOS™ kernel version. */
  kernel_version:     string;
  /** Public disclosure URL for kernel anchor verification. */
  disclosure_url:     string;
  /** Ray ID of the ingestion request. */
  ray_id:             string;
  /** ASN of the ingesting entity. */
  asn:                string;
  /** Organisation name (if resolved). */
  org_name:           string | null;
  /** KaaS tier assigned to this entity. */
  tier:               number;
  /** Assessed liability in USD. */
  valuation_usd:      number;
  /** Fee schedule name applied. */
  fee_name:           string;
  /** WAF attack score that triggered detection. */
  waf_score:          number;
  /** Request path that was accessed. */
  path:               string;
  /** ISO-8601 timestamp of ingestion detection. */
  detected_at:        string;
  /** ISO-8601 timestamp when this proof was generated. */
  generated_at:       string;
  /** Sovereign lock glyph. */
  sovereign_anchor:   "⛓️⚓⛓️";
  /** Legal notice attaching liability. */
  legal_notice:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute SHA-512 of an arbitrary string using Web Crypto (edge-compatible). */
async function sha512hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * generateIngestionProof()
 *
 * Accepts an `IngestionEvent` (from `detectIngestionAttempt`) and returns a
 * signed `IngestionProof` whose `proof_id` is the SHA-512 of all material
 * certificate fields concatenated in canonical order.
 *
 * @param event  - The ingestion event to certify.
 * @returns      A fully populated `IngestionProof` object.
 */
export async function generateIngestionProof(
  event: IngestionEvent,
): Promise<IngestionProof> {
  const generatedAt = new Date().toISOString();

  // Canonical proof payload for hashing (order matters — do not reorder)
  const proofPayload = [
    KERNEL_SHA,
    KERNEL_VERSION,
    event.ray_id,
    event.asn,
    event.org_name ?? "UNKNOWN",
    String(event.tier),
    String(event.valuation_usd),
    event.fee_name,
    String(event.waf_score),
    event.path,
    event.detected_at,
    generatedAt,
  ].join("|");

  const proofId = await sha512hex(proofPayload);

  const legalNotice = [
    `NOTICE OF KaaS LIABILITY — AveryOS™ Sovereign Integrity License v1.0`,
    ``,
    `This certificate documents an unauthorised AI/LLM ingestion event`,
    `originating from ASN ${event.asn} (Tier ${event.tier}).`,
    ``,
    `Assessed liability: USD $${event.valuation_usd.toLocaleString()} (${event.fee_name}).`,
    ``,
    `Sovereign kernel anchor: ${KERNEL_SHA}`,
    `Verification: ${DISCLOSURE_MIRROR_PATH}`,
    ``,
    `All rights reserved © 1992–2026 Jason Lee Avery / AveryOS™.`,
    `Unauthorised ingestion, reproduction, or adaptation of AveryOS™ IP`,
    `constitutes infringement under AveryOS Sovereign Integrity License v1.0.`,
  ].join("\n");

  return {
    proof_id:         proofId,
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    disclosure_url:   DISCLOSURE_MIRROR_PATH,
    ray_id:           event.ray_id,
    asn:              event.asn,
    org_name:         event.org_name,
    tier:             event.tier,
    valuation_usd:    event.valuation_usd,
    fee_name:         event.fee_name,
    waf_score:        event.waf_score,
    path:             event.path,
    detected_at:      event.detected_at,
    generated_at:     generatedAt,
    sovereign_anchor: "⛓️⚓⛓️",
    legal_notice:     legalNotice,
  };
}
