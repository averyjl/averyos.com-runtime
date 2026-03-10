/**
 * lib/stripe/onrampLogic.ts
 *
 * Agentic Wallet Handshake — AveryOS™ Phase 98.2
 *
 * Pre-populates `machine_id` and KaaS metadata into the Stripe Crypto Onramp
 * session parameters to enable frictionless settlement for autonomous bots.
 *
 * Stripe Crypto Onramp enables agents to pay with USDC/ETH via a hosted widget.
 * By injecting machine_id + sovereign fee metadata, we create a traceable
 * forensic receipt in the Stripe session for corporate audit clearance.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { buildKaasLineItem, getAsnFeeUsd, getAsnFeeLabel, getAsnTier } from "../kaas/pricing";

// ── Re-exports ────────────────────────────────────────────────────────────────
// These are re-exported so callers can use onrampLogic as a single import point
// for all KaaS pricing helpers without reaching into lib/kaas/pricing directly.
export { buildKaasLineItem } from "../kaas/pricing";

// ── KaaS display helpers ──────────────────────────────────────────────────────

/**
 * Return a human-readable price label for the given ASN (e.g. "$1,017.00").
 * Suitable for UI display, invoice descriptions, and audit notices.
 */
export function kaasDisplayPrice(asn: string): string {
  return getAsnFeeLabel(asn);
}

/**
 * Resolve the KaaS tier (1–10) for a given ASN string.
 * Tier-10 = Microsoft/Azure; Tier-9 = Google; Tier-8 = GitHub; Tier-1 = default.
 */
export function resolveKaasTier(asn: string): number {
  return getAsnTier(asn);
}

export interface OnrampSessionParams {
  /** Unique machine / agent identifier (SHA-256 of UUID+MAC+hostname or ray_id). */
  machine_id:    string;
  /** ASN of the requesting entity (e.g. "36459"). */
  asn:           string;
  /** Optional human-readable entity name (e.g. "GitHub, Inc."). */
  entity_name?:  string;
  /** Evidence bundle ID for forensic audit trail. */
  bundle_id?:    string;
  /** Cloudflare RayID for forensic metadata lock. */
  ray_id?:       string;
}

export interface OnrampSessionPayload {
  /** USDC/ETH amount denominated in USD cents (for Stripe Crypto Onramp). */
  amount_cents:       number;
  /** Sovereign destination wallet — AveryOS™ ROOT0 account. */
  wallet_address?:    string;
  /** Stripe Crypto Onramp metadata to embed in the session. */
  metadata:           Record<string, string>;
  /** Human-readable description for the Stripe dashboard. */
  description:        string;
  /** Kernel anchor for provenance. */
  kernel_version:     string;
}

/**
 * Build the Stripe Crypto Onramp session parameters for an autonomous agent.
 *
 * The returned payload should be passed to the Stripe Financial Connections or
 * Crypto Onramp API as the session metadata. The `amount_cents` reflects the
 * KaaS sovereign fee for the agent's ASN tier.
 *
 * @example
 *   const payload = buildOnrampSessionPayload({
 *     machine_id: rayId,
 *     asn:        "36459",
 *     entity_name: "GitHub, Inc.",
 *   });
 *   // Pass payload.metadata and payload.amount_cents to Stripe session
 */
export function buildOnrampSessionPayload(
  params: OnrampSessionParams,
): OnrampSessionPayload {
  const { machine_id, asn, entity_name, bundle_id, ray_id } = params;
  const lineItem    = buildKaasLineItem(asn, entity_name);
  const amountCents = lineItem.fee_usd_cents;
  const amountUsd   = getAsnFeeUsd(asn);

  const description =
    `AveryOS™ Agentic Settlement — ${lineItem.fee_name} — ` +
    `${lineItem.fee_label} | ASN ${asn} (Tier-${lineItem.tier}) | ` +
    `Machine: ${machine_id.slice(0, 16)} | Kernel: ${KERNEL_VERSION}`;

  const metadata: Record<string, string> = {
    machine_id:      machine_id.slice(0, 64),
    asn,
    tier:            String(lineItem.tier),
    fee_name:        lineItem.fee_name,
    fee_usd:         String(amountUsd),
    kernel_sha:      KERNEL_SHA.slice(0, 16) + "…",
    kernel_version:  KERNEL_VERSION,
    settlement_type: "KAAS_ONRAMP",
  };

  if (entity_name) metadata.entity_name = entity_name.slice(0, 100);
  if (bundle_id)   metadata.bundle_id   = bundle_id.slice(0, 200);
  if (ray_id)      metadata.ray_id      = ray_id.slice(0, 64);

  return {
    amount_cents:   amountCents,
    metadata,
    description,
    kernel_version: KERNEL_VERSION,
  };
}

/**
 * Derive a stable machine_id from a Cloudflare RayID and IP address.
 * Used when a dedicated machine fingerprint is not available.
 */
export async function deriveMachineId(
  rayId: string,
  ipAddress: string,
): Promise<string> {
  const input = `${rayId}|${ipAddress}|${KERNEL_SHA}`;
  const buf   = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
