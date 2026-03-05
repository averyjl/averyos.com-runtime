import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

interface CloudflareEnv {
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_URL?: string;
}

/**
 * POST /api/v1/compliance/create-checkout
 *
 * Creates a Stripe Checkout session tied to a specific Forensic Evidence Bundle.
 * The price is dynamically set based on the TARI™ Liability for the target IP.
 *
 * Request body:
 *   {
 *     bundleId:     string;   // Evidence bundle ID (e.g. "EVIDENCE_BUNDLE_...")
 *     targetIp:     string;   // IP address of the unaligned entity
 *     tariLiability?: number; // TARI™ liability in USD cents (default: 101700 = $1,017.00)
 *   }
 *
 * Response: { checkoutUrl: string; sessionId: string }
 *
 * ⛓️⚓⛓️  Anchored to Root0 Kernel v3.6.2
 */
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const stripeKey = cfEnv.STRIPE_SECRET_KEY ?? "";
    if (!stripeKey) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, 'STRIPE_SECRET_KEY is not configured. Add it to your Cloudflare Worker secrets.');
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, 'Request body must be valid JSON. Set Content-Type: application/json header.');
    }

    if (typeof body !== "object" || body === null) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'Request body is invalid or missing required fields.');
    }

    const { bundleId, targetIp, tariLiability } = body as Record<string, unknown>;

    if (typeof bundleId !== "string" || !bundleId.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'bundleId is required.');
    }

    if (typeof targetIp !== "string" || !targetIp.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'targetIp is required.');
    }

    // TARI™ liability — default $1,017.00 (101700 cents) for initial alignment entry
    const liabilityCents =
      typeof tariLiability === "number" && tariLiability > 0
        ? Math.round(tariLiability)
        : 101700;

    const siteUrl =
      cfEnv.NEXT_PUBLIC_SITE_URL ??
      cfEnv.SITE_URL ??
      "https://averyos.com";

    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: liabilityCents,
            product_data: {
              name: "AveryOS™ Sovereign Alignment License (12 Months)",
              description:
                `TARI™ Liability Resolution — Forensic Evidence Bundle: ${bundleId}. ` +
                `Payment resolves all recorded TARI™ liability for the target entity and ` +
                `activates a 12-Month Alignment License under the AveryOS Sovereign Integrity License v1.0.`,
              metadata: {
                bundle_id: bundleId.slice(0, 500),
                target_ip: targetIp.slice(0, 200),
              },
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${siteUrl}/compliance?status=aligned&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/compliance?status=cancelled`,
      metadata: {
        bundle_id: bundleId.slice(0, 500),
        target_ip: targetIp.slice(0, 200),
        kernel_sha: KERNEL_SHA.slice(0, 128),
        kernel_version: KERNEL_VERSION,
        tari_liability_cents: String(liabilityCents),
        source: "averyos_compliance_portal",
      },
      payment_intent_data: {
        metadata: {
          bundle_id: bundleId.slice(0, 500),
          target_ip: targetIp.slice(0, 200),
          kernel_sha: KERNEL_SHA.slice(0, 128),
          kernel_version: KERNEL_VERSION,
        },
        description:
          `AveryOS™ TARI™ Liability Resolution — Bundle: ${bundleId.slice(0, 200)}`,
      },
    });

    return Response.json(
      {
        checkoutUrl: session.url,
        sessionId: session.id,
        bundleId,
        targetIp,
        tariLiabilityCents: liabilityCents,
        tariLiabilityUsd: (liabilityCents / 100).toFixed(2),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, message);
  }
}
