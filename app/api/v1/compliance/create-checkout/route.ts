import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";

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
      return Response.json(
        { error: "STRIPE_NOT_CONFIGURED", detail: "STRIPE_SECRET_KEY is not set." },
        { status: 503 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "MALFORMED_JSON" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return Response.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { bundleId, targetIp, tariLiability } = body as Record<string, unknown>;

    if (typeof bundleId !== "string" || !bundleId.trim()) {
      return Response.json(
        { error: "MISSING_BUNDLE_ID", detail: "bundleId is required." },
        { status: 400 }
      );
    }

    if (typeof targetIp !== "string" || !targetIp.trim()) {
      return Response.json(
        { error: "MISSING_TARGET_IP", detail: "targetIp is required." },
        { status: 400 }
      );
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
    return Response.json(
      { error: "CHECKOUT_ERROR", detail: message },
      { status: 500 }
    );
  }
}
