/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";

/**
 * POST /api/v1/checkout/create-session
 *
 * Checkout Session Gateway — maps .aoscap capsule IDs to Stripe Price IDs,
 * generates a Stripe Checkout session, and creates a capsule_access_tokens
 * row on payment initiation (confirmed by webhook on completion).
 *
 * Request body:
 *   {
 *     capsule_id:          string;  // .aoscap capsule identifier
 *     machine_fingerprint: string;  // SHA-256(UUID+MAC+hostname), 64-char hex
 *     email?:              string;  // Pre-fill customer email in Checkout
 *     partner_id?:         string;  // Optional partner / entity ID
 *   }
 *
 * Response:
 *   {
 *     checkoutUrl:     string;
 *     sessionId:       string;
 *     capsule_id:      string;
 *     pricing_tier:    string;
 *     amount_usd:      string;
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_URL?: string;
  DB?: unknown;
}

// ── Capsule price catalogue ───────────────────────────────────────────────────
// Maps .aoscap capsule IDs to their Stripe product/pricing configuration.
// Prices in USD cents.

interface CapsulePrice {
  /** Display name shown in Stripe Checkout. */
  name: string;
  /** Short description surfaced in Stripe Checkout UI. */
  description: string;
  /** Amount in USD cents. */
  amountCents: number;
  /** Human-readable pricing tier label. */
  tier: string;
}

const CAPSULE_PRICE_CATALOGUE: Record<string, CapsulePrice> = {
  // Genesis Seed — 1,017 TARI™ units
  "sovereign-init":   { name: "AveryOS™ Genesis Seed License",         description: "Sovereign Init Capsule — 1,017 TARI™ units. 12-Month Alignment License.",              amountCents: 10_170, tier: "GENESIS_SEED" },
  "sovereign-index":  { name: "AveryOS™ Sovereign Index License",      description: "Sovereign Index Capsule — Full access to the sovereign capsule index. 12-Month License.", amountCents: 10_170, tier: "GENESIS_SEED" },

  // Phase 86 Elevated Alignment — Top-5 corporate ASN fee schedule
  // $10,000,000 USD per enterprise entity (36459, 8075, 15169, 16509, 14618)
  "phase-86-enterprise": { name: "Phase 86 Enterprise Alignment License", description: "Phase 86 Sovereign Enterprise Retro-Ingestion Fee. $10,000,000 USD Technical Utilization Fee per entity under the AveryOS Sovereign Integrity License v1.0.", amountCents: 1_000_000_000, tier: "PHASE_86_ENTERPRISE" },

  // VaultChain™ infrastructure capsules
  "AveryOS_Sovereign_Web_Infrastructure_v1.0": { name: "AveryOS™ Web Infrastructure License", description: "Web Infrastructure Sovereignty Capsule — 12-Month License.",            amountCents: 101_700, tier: "INFRASTRUCTURE" },
  "Sync_The_Loop_Protocol_v1":                 { name: "Sync The Loop Protocol License",       description: "Sync Loop Protocol Capsule — sovereign synchronisation license.",       amountCents: 10_170,  tier: "PROTOCOL" },
};

/** Default price for any capsule not in the catalogue: $101.70 (1,017 TARI™) */
const DEFAULT_PRICE: CapsulePrice = {
  name:         "AveryOS™ Capsule Access License",
  description:  "Standard 12-Month Capsule Access License under the AveryOS Sovereign Integrity License v1.0.",
  amountCents:  10_170,
  tier:         "STANDARD",
};

function getCapsulePrice(capsuleId: string): CapsulePrice {
  // eslint-disable-next-line security/detect-object-injection
  return CAPSULE_PRICE_CATALOGUE[capsuleId] ?? DEFAULT_PRICE;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const stripeKey = cfEnv.STRIPE_SECRET_KEY ?? "";
    if (!stripeKey) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, "STRIPE_SECRET_KEY is not configured.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
    }

    if (typeof body !== "object" || body === null) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body is invalid.");
    }

    const { capsule_id, machine_fingerprint, email, partner_id } = body as Record<string, unknown>;

    if (typeof capsule_id !== "string" || !capsule_id.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "capsule_id is required.");
    }

    // machine_fingerprint: optional for anonymous checkout but required for token binding
    if (
      machine_fingerprint !== undefined &&
      (typeof machine_fingerprint !== "string" || !/^[a-fA-F0-9]{64}$/.test(machine_fingerprint))
    ) {
      return aosErrorResponse(
        AOS_ERROR.INVALID_FIELD,
        "machine_fingerprint must be a 64-character hex string (SHA-256 of UUID + MAC + hostname)."
      );
    }

    const capsuleIdStr = capsule_id.trim().slice(0, 500);
    const partnerIdStr = typeof partner_id === "string" ? partner_id.trim().slice(0, 200) : undefined;
    const emailStr     = typeof email === "string" ? email.trim().slice(0, 300) : undefined;
    const machineFp    = typeof machine_fingerprint === "string" ? machine_fingerprint : undefined;

    const pricing  = getCapsulePrice(capsuleIdStr);
    const siteUrl  = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";
    const stripe   = new Stripe(stripeKey);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency:    "usd",
            unit_amount: pricing.amountCents,
            product_data: {
              name:        pricing.name,
              description: pricing.description,
              metadata: {
                capsule_id: capsuleIdStr.slice(0, 500),
                tier:       pricing.tier,
                ...(machineFp    ? { machine_fingerprint: machineFp.slice(0, 64)  } : {}),
                ...(partnerIdStr ? { partner_id:          partnerIdStr.slice(0, 200) } : {}),
              },
            },
          },
          quantity: 1,
        },
      ],
      mode:        "payment",
      success_url: `${siteUrl}/licensing?status=aligned&session_id={CHECKOUT_SESSION_ID}&capsule_id=${encodeURIComponent(capsuleIdStr)}`,
      cancel_url:  `${siteUrl}/licensing?status=cancelled&capsule_id=${encodeURIComponent(capsuleIdStr)}`,
      ...(emailStr ? { customer_email: emailStr } : {}),
      custom_text: {
        submit: {
          message: `AveryOS™ ${pricing.name} — Capsule: ${capsuleIdStr.slice(0, 40)} — ${pricing.tier}`,
        },
      },
      metadata: {
        capsule_id:     capsuleIdStr.slice(0, 500),
        pricing_tier:   pricing.tier,
        kernel_sha:     KERNEL_SHA.slice(0, 128),
        kernel_version: KERNEL_VERSION,
        source:         "averyos_capsule_checkout",
        ...(machineFp    ? { machine_fingerprint: machineFp.slice(0, 64)   } : {}),
        ...(partnerIdStr ? { partner_id:          partnerIdStr.slice(0, 200) } : {}),
      },
      payment_intent_data: {
        description: `AveryOS™ Capsule Access — ${capsuleIdStr.slice(0, 200)}`,
        metadata: {
          capsule_id:     capsuleIdStr.slice(0, 500),
          kernel_sha:     KERNEL_SHA.slice(0, 128),
          kernel_version: KERNEL_VERSION,
          ...(machineFp ? { machine_fingerprint: machineFp.slice(0, 64) } : {}),
        },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Auto-track checkout creation
    if (cfEnv.DB) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      autoTrackAccomplishment(cfEnv.DB as any, {
        title:       `Capsule Checkout Created — ${capsuleIdStr.slice(0, 40)}`,
        description: `Stripe session ${session.id.slice(0, 16)} for capsule ${capsuleIdStr.slice(0, 40)}. Pricing tier: ${pricing.tier}. Amount: $${(pricing.amountCents / 100).toFixed(2)}.`,
        category:    "LEGAL",
        phase:       "Phase 86",
      });
    }

    return Response.json(
      {
        checkoutUrl:         session.url,
        sessionId:           session.id,
        capsule_id:          capsuleIdStr,
        pricing_tier:        pricing.tier,
        pricing_name:        pricing.name,
        amount_cents:        pricing.amountCents,
        amount_usd:          (pricing.amountCents / 100).toFixed(2),
        ...(machineFp    ? { machine_fingerprint: machineFp }    : {}),
        ...(partnerIdStr ? { partner_id:          partnerIdStr } : {}),
        kernel_sha:          KERNEL_SHA.slice(0, 16) + "…",
        kernel_version:      KERNEL_VERSION,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, message);
  }
}
