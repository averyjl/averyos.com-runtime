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
 * POST /api/v1/kaas/settle
 *
 * KaaS (Kernel-as-a-Service) Settlement API — Phase 99.4
 *
 * Creates a Stripe Checkout session for an "Audit Clearance Fee" or
 * "Sovereign Partnership Retainer" associated with a kaas_valuations row.
 *
 * Request body (JSON):
 *   {
 *     valuation_id?: number   — Optional kaas_valuations row ID to settle
 *     machine_id?:  string    — Machine/entity identifier (pre-populates checkout)
 *     asn?:         string    — ASN of the settling entity
 *     tier?:        number    — KaaS tier (1–10); determines fee schedule
 *     ray_id?:      string    — Forensic RayID from the breach event
 *   }
 *
 * Returns: { checkout_url, session_id, amount_usd, product_name }
 *
 * Auth: Bearer VAULT_PASSPHRASE or public (no auth) for self-service settlement.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import {
  getAsnTier,
  getAsnFeeUsdCents,
  getAsnFeeLabel,
} from "../../../../../lib/kaas/pricing";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CloudflareEnv {
  STRIPE_SECRET_KEY?:  string;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_URL?:           string;
  DB?:                 D1Database;
}

interface D1Database {
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } };
}

interface KaasValuationRow {
  id:            number;
  asn:           string;
  ip_address:    string;
  tier:          number;
  valuation_usd: number;
  status:        string;
  ray_id:        string | null;
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const stripeKey = cfEnv.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "STRIPE_SECRET_KEY is not configured.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const machineId = String(body.machine_id  ?? "").trim();
  const asnParam  = String(body.asn         ?? "").trim();
  const rayId     = String(body.ray_id      ?? "").trim();
  const now       = formatIso9();

  // ── Resolve ASN + tier from valuation_id or request params ───────────────
  let asn  = asnParam;
  let tier = Number(body.tier ?? 0);
  let valuationId: number | null = Number(body.valuation_id) || null;
  let existingStatus: string | null = null;

  if (valuationId && cfEnv.DB) {
    try {
      const row = await cfEnv.DB.prepare(
        `SELECT * FROM kaas_valuations WHERE id = ? LIMIT 1`
      ).bind(valuationId).first<KaasValuationRow>();

      if (row) {
        asn            = row.asn;
        tier           = row.tier;
        existingStatus = row.status;
        if (!asnParam) valuationId = row.id;
      }
    } catch {
      // Non-fatal — proceed with request params
    }
  }

  if (!asn) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "asn (or valuation_id) is required.");
  }

  // Block settlement of already-settled rows
  if (existingStatus === "SETTLED") {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "This valuation has already been settled.");
  }

  // ── Determine tier + fee ──────────────────────────────────────────────────
  if (!tier) tier = getAsnTier(asn);
  const feeCents    = getAsnFeeUsdCents(asn);
  const feeLabel    = getAsnFeeLabel(asn);

  let productName: string;
  let productDesc: string;

  if (tier >= 9) {
    productName = "AveryOS™ Sovereign Partnership Retainer";
    productDesc =
      `KaaS Good Faith Deposit — ASN ${asn} (Tier-${tier}). ` +
      `Clears LEGAL_SCAN status on the Verified Ingestor Registry. ` +
      `${feeLabel} settlement fee. Kernel: ${KERNEL_VERSION}`;
  } else if (tier >= 7) {
    productName = "AveryOS™ Forensic Alignment Fee";
    productDesc =
      `KaaS Forensic Valuation Settlement — ASN ${asn} (Tier-${tier}). ` +
      `${feeLabel} alignment fee. Kernel: ${KERNEL_VERSION}`;
  } else {
    productName = "AveryOS™ Audit Clearance Fee";
    productDesc =
      `KaaS Audit Clearance — ASN ${asn} (Tier-${tier}). ` +
      `Standard ${feeLabel} alignment fee. Kernel: ${KERNEL_VERSION}`;
  }

  // ── Create Stripe Checkout ────────────────────────────────────────────────
  const stripe  = new Stripe(stripeKey);
  const baseUrl = (cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com").replace(/\/$/, "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency:     "usd",
            unit_amount:  feeCents,
            product_data: { name: productName, description: productDesc },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/licensing?settlement=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/registry?settlement=cancelled`,
      metadata: {
        kaas_valuation_id: valuationId ? String(valuationId) : "",
        asn:               asn.slice(0, 200),
        tier:              String(tier),
        machine_id:        machineId.slice(0, 500),
        ray_id:            rayId.slice(0, 200),
        kernel_sha:        KERNEL_SHA.slice(0, 128),
        kernel_version:    KERNEL_VERSION,
        settlement_type:   "KAAS_SETTLEMENT",
        created_at:        now,
      },
    });

    // ── Update kaas_valuations with checkout URL (non-fatal) ─────────────
    if (valuationId && cfEnv.DB && session.url) {
      try {
        await cfEnv.DB.prepare(
          `UPDATE kaas_valuations
             SET stripe_checkout_url = ?
           WHERE id = ?`
        ).bind(session.url, valuationId).run();
      } catch {
        // Non-fatal
      }
    }

    return Response.json({
      status:        "SETTLEMENT_SESSION_CREATED",
      checkout_url:  session.url,
      session_id:    session.id,
      amount_usd:    feeCents / 100,
      fee_label:     feeLabel,
      product_name:  productName,
      asn,
      tier,
      machine_id:    machineId || null,
      ray_id:        rayId || null,
      created_at:    now,
      kernel_sha:    KERNEL_SHA.slice(0, 16) + "…",
      kernel_version: KERNEL_VERSION,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, `Stripe session creation failed: ${message}`);
  }
}
