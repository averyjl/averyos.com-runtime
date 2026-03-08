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
 * Enterprise ASNs that trigger a $1,000,000 "Sovereign Alignment Deposit".
 *   36459  — GitHub / Microsoft (US)
 *   211590 — FBW Networks (France)
 *   198488 — Colocall Ltd / Kyiv recon probe (UA)
 */
const ENTERPRISE_ASNS = new Set(["36459", "211590", "198488"]);

/** Enterprise Alignment Deposit: $1,000,000 USD */
const ENTERPRISE_DEPOSIT_CENTS = 100_000_000;

/** Individual Genesis Seed License: $101.70 USD (1,017 TARI™) */
const INDIVIDUAL_LICENSE_CENTS = 10_170;

type PricingTier = "ENTERPRISE_DEPOSIT" | "INDIVIDUAL_LICENSE" | "CUSTOM";

interface PricingResult {
  liabilityCents: number;
  productName: string;
  productDescription: string;
  pricingTier: PricingTier;
}

/** Returns true when the ASN belongs to a known enterprise entity. */
function isEnterpriseAsn(asn: string): boolean {
  return ENTERPRISE_ASNS.has(asn);
}

/** Derives the complete pricing result from request parameters. */
function determinePricing(
  tariLiability: unknown,
  asnStr: string,
  rayIdStr: string,
  bundleId: string,
): PricingResult {
  if (typeof tariLiability === "number" && tariLiability > 0) {
    return {
      liabilityCents: Math.round(tariLiability),
      productName: "AveryOS™ Sovereign Alignment License (12 Months)",
      productDescription:
        `TARI™ Liability Resolution — Forensic Evidence Bundle: ${bundleId}. ` +
        `Payment resolves all recorded TARI™ liability for the target entity and ` +
        `activates a 12-Month Alignment License under the AveryOS Sovereign Integrity License v1.0.`,
      pricingTier: "CUSTOM",
    };
  }

  if (asnStr && isEnterpriseAsn(asnStr)) {
    return {
      liabilityCents: ENTERPRISE_DEPOSIT_CENTS,
      productName: "AveryOS™ Enterprise Retro-Ingestion Deposit",
      productDescription:
        `Sovereign Alignment Verification — ASN ${asnStr} — ` +
        (rayIdStr
          ? `Truth-Alignment Required for Forensic RayID: ${rayIdStr}. `
          : "") +
        `This $1,000,000 Good Faith Deposit initiates the Enterprise Retro-Ingestion ` +
        `settlement process under the AveryOS Sovereign Integrity License v1.0. ` +
        `Forensic Evidence Bundle: ${bundleId}.`,
      pricingTier: "ENTERPRISE_DEPOSIT",
    };
  }

  return {
    liabilityCents: INDIVIDUAL_LICENSE_CENTS,
    productName: "AveryOS™ Genesis Seed Individual License",
    productDescription:
      `Truth-Alignment Activation — Forensic Evidence Bundle: ${bundleId}. ` +
      `This 12-Month Genesis Seed License activates sovereign alignment under the ` +
      `AveryOS Sovereign Integrity License v1.0.`,
    pricingTier: "INDIVIDUAL_LICENSE",
  };
}

/**
 * POST /api/v1/compliance/create-checkout
 *
 * Creates a Stripe Checkout session tied to a specific Forensic Evidence Bundle.
 * Pricing is determined by the caller's ASN:
 *   - Enterprise ASNs (36459, 211590, 198488) → $1,000,000 "Enterprise Retro-Ingestion Deposit"
 *   - All others → $101.70 "Genesis Seed Individual License"
 *
 * The tariLiability field may still be supplied directly to override ASN-derived pricing
 * (used by the invoice pipeline for custom amounts).
 *
 * Request body:
 *   {
 *     bundleId:       string;   // Evidence bundle ID (e.g. "EVIDENCE_BUNDLE_...")
 *     targetIp:       string;   // IP address of the unaligned entity
 *     rayId?:         string;   // Cloudflare Ray ID for forensic metadata lock
 *     asn?:           string;   // ASN of the requesting entity (e.g. "36459")
 *     tariLiability?: number;   // Override: TARI™ liability in USD cents
 *   }
 *
 * Response: { checkoutUrl: string; sessionId: string }
 *
 * ⛓️⚓⛓️  Anchored to Root0 Kernel v3.6.2 | LOCKED AT 156.2k PULSE | 962 ENTITIES DOCUMENTED
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

    const { bundleId, targetIp, rayId, asn, tariLiability } = body as Record<string, unknown>;

    if (typeof bundleId !== "string" || !bundleId.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'bundleId is required.');
    }

    if (typeof targetIp !== "string" || !targetIp.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'targetIp is required.');
    }

    const asnStr = typeof asn === "string" ? asn.trim() : "";
    const rayIdStr = typeof rayId === "string" ? rayId.trim() : "";

    const { liabilityCents, productName, productDescription, pricingTier } =
      determinePricing(tariLiability, asnStr, rayIdStr, bundleId);

    const siteUrl =
      cfEnv.NEXT_PUBLIC_SITE_URL ??
      cfEnv.SITE_URL ??
      "https://averyos.com";

    const stripe = new Stripe(stripeKey);

    // Build a human-readable Stripe statement descriptor that includes the
    // RayID proof fingerprint.
    // Stripe limits: max 22 chars, alphanumeric + spaces; must not start/end
    // with a space.  Format: "AOS <RAYID_TRUNCATED>" or "AOS TARI COMPLIANCE".
    // The "AOS " prefix (4 chars) + up to 16 chars from rayId = max 20 chars.
    const rayIdClean = rayIdStr.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim();
    const statementDescriptor = rayIdClean
      ? `AOS ${rayIdClean.slice(0, 16).trimEnd()}`
      : "AOS TARI COMPLIANCE";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: liabilityCents,
            product_data: {
              name: productName,
              description: productDescription,
              metadata: {
                bundle_id: bundleId.slice(0, 500),
                target_ip: targetIp.slice(0, 200),
                ...(asnStr ? { asn: asnStr } : {}),
                ...(rayIdStr ? { ray_id: rayIdStr.slice(0, 200) } : {}),
              },
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${siteUrl}/compliance?status=aligned&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/compliance?status=cancelled`,
      // ── Sovereign Branding — Deep Black + Gold RayID Proof ─────────────────
      // custom_text surfaces the RayID directly in the Stripe-hosted checkout UI.
      custom_text: {
        submit: {
          message: rayIdStr
            ? `RayID Proof: ${rayIdStr.slice(0, 64)} — AveryOS™ Sovereign Alignment License v1.0`
            : "AveryOS™ Sovereign Alignment License v1.0 — TARI™ Liability Resolution",
        },
      },
      metadata: {
        bundle_id: bundleId.slice(0, 500),
        target_ip: targetIp.slice(0, 200),
        kernel_sha: KERNEL_SHA.slice(0, 128),
        kernel_version: KERNEL_VERSION,
        tari_liability_cents: String(liabilityCents),
        source: "averyos_compliance_portal",
        milestone: "LOCKED AT 162.2k PULSE | 962 ENTITIES DOCUMENTED",
        ...(asnStr ? { asn: asnStr } : {}),
        ...(rayIdStr ? { ray_id: rayIdStr.slice(0, 200) } : {}),
      },
      payment_intent_data: {
        // statement_descriptor maps the RayID Proof directly into the bank record.
        statement_descriptor: statementDescriptor,
        metadata: {
          bundle_id: bundleId.slice(0, 500),
          target_ip: targetIp.slice(0, 200),
          kernel_sha: KERNEL_SHA.slice(0, 128),
          kernel_version: KERNEL_VERSION,
          ...(asnStr ? { asn: asnStr } : {}),
          ...(rayIdStr ? { ray_id: rayIdStr.slice(0, 200) } : {}),
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
        ...(asnStr ? { asn: asnStr } : {}),
        ...(rayIdStr ? { rayId: rayIdStr } : {}),
        tariLiabilityCents: liabilityCents,
        tariLiabilityUsd: (liabilityCents / 100).toFixed(2),
        pricingTier,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, message);
  }
}
