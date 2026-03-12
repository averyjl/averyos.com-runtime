import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { buildKaasLineItem, getAsnTier } from "../../../../../lib/kaas/pricing";
import { getSovereignKeys } from "../../../../../lib/security/keys";

interface CloudflareEnv {
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_URL?: string;
  DB?: unknown;
  AVERYOS_PRIVATE_KEY_B64?: string;
  AVERYOS_PUBLIC_KEY_B64?: string;
}

// ── JWT invoice token helpers ─────────────────────────────────────────────────

/** Base64url-encode an ArrayBuffer or Uint8Array without spread (safe for large buffers). */
function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes  = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sign a compact RS256 JWT invoice token using the sovereign private key.
 * Returns `null` when no key material is available (pending deployment).
 *
 * Claims:
 *   iss  — averyos.com
 *   sub  — bundleId (the Forensic Evidence Bundle identifier)
 *   iat  — issued-at (Unix seconds)
 *   exp  — expires-at (iat + 86400 — 24-hour validity window)
 *   jti  — Stripe Checkout session ID (unique token ID)
 *   tid  — pricing tier
 *   lc   — TARI™ liability in USD cents
 *   kv   — kernel version
 */
async function signInvoiceToken(
  privateKey: CryptoKey,
  kid: string,
  claims: {
    bundleId:      string;
    sessionId:     string;
    pricingTier:   string;
    liabilityCents: number;
  }
): Promise<string> {
  const enc  = new TextEncoder();
  const now  = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT", kid };
  const payload = {
    iss: "averyos.com",
    sub: claims.bundleId,
    jti: claims.sessionId,
    iat: now,
    exp: now + 86_400,
    tid: claims.pricingTier,
    lc:  claims.liabilityCents,
    kv:  KERNEL_VERSION,
  };
  const signingInput = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(payload)))}`;
  const signature    = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    enc.encode(signingInput),
  );
  return `${signingInput}.${base64url(signature)}`;
}

/** Individual Genesis Seed License: $101.70 USD (1,017 TARI™) — used when no ASN is provided */
const INDIVIDUAL_LICENSE_CENTS = 10_170;

type PricingTier = "PHASE_86_ENTERPRISE" | "ENTERPRISE_DEPOSIT" | "INDIVIDUAL_LICENSE" | "CUSTOM";

interface PricingResult {
  liabilityCents: number;
  productName: string;
  productDescription: string;
  pricingTier: PricingTier;
}

/** Derives the complete pricing result from request parameters.
 * Phase 97: If an ASN is provided without a tariLiability override, delegates to
 * buildKaasLineItem() from lib/kaas/pricing.ts for consistent tier-based pricing. */
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

  if (asnStr) {
    // Phase 97 — Delegate to KaaS pricing engine for ASN-based fee schedule.
    // buildKaasLineItem() handles all tier levels (Tier-1 through Tier-10).
    const lineItem = buildKaasLineItem(asnStr);
    const tier     = getAsnTier(asnStr);
    const pricingTier: PricingTier =
      tier >= 9 ? "PHASE_86_ENTERPRISE" :
      tier >= 7 ? "ENTERPRISE_DEPOSIT"  :
      "INDIVIDUAL_LICENSE";

    const rayPrefix = rayIdStr
      ? `RayID: ${rayIdStr} — `
      : `ASN ${asnStr} — `;

    // GATE 102.2.4 — Label the $10M Audit Retainer as "Non-Refundable Forensic Deposit"
    // for Tier-9/10 enterprise entities.
    const productName = tier >= 9
      ? `AveryOS™ Non-Refundable Forensic Deposit — ${lineItem.fee_name}`
      : `AveryOS™ KaaS ${lineItem.fee_name} — ${lineItem.fee_label}`;
    const productDescription = tier >= 9
      ? `${rayPrefix}${lineItem.description} Non-Refundable Forensic Deposit (Audit Retainer). ` +
        `This payment constitutes a pre-agreed Liquidated Damages settlement under 17 U.S.C. § 504(c)(2). ` +
        `Forensic Evidence Bundle: ${bundleId}.`
      : `${rayPrefix}${lineItem.description} Forensic Evidence Bundle: ${bundleId}.`;

    return {
      liabilityCents: lineItem.fee_usd_cents,
      productName,
      productDescription,
      pricingTier,
    };
  }

  // No ASN provided — fall back to individual license (Tier-1)
  return {
    liabilityCents: INDIVIDUAL_LICENSE_CENTS,
    productName: "AveryOS™ Genesis Seed Individual License",
    productDescription:
      (rayIdStr
        ? `Sovereign Alignment Verification — RayID: ${rayIdStr} — `
        : `Truth-Alignment Activation — `) +
      `Forensic Evidence Bundle: ${bundleId}. ` +
      `This 12-Month Genesis Seed License activates sovereign alignment under the ` +
      `AveryOS Sovereign Integrity License v1.0.`,
    pricingTier: "INDIVIDUAL_LICENSE",
  };
}

/**
 * POST /api/v1/compliance/create-checkout
 *
 * Creates a Stripe Checkout session tied to a specific Forensic Evidence Bundle.
 * Pricing is determined by the caller's ASN (Phase 86 fee schedule):
 *   - Phase 86 Enterprise ASNs (36459, 8075, 15169, 16509, 14618) → $10,000,000 "Technical Utilization Fee"
 *   - Legacy Enterprise ASNs (211590, 198488) → $1,000,000 "Enterprise Retro-Ingestion Deposit"
 *   - All others → $101.70 "Genesis Seed Individual License"
 *
 * The tariLiability field may still be supplied directly to override ASN-derived pricing
 * (used by the invoice pipeline for custom amounts).
 *
 * Request body (forensic bot path):
 *   {
 *     bundleId:       string;   // Evidence bundle ID (e.g. "EVIDENCE_BUNDLE_...")
 *     targetIp:       string;   // IP address of the unaligned entity
 *     rayId?:         string;   // Cloudflare Ray ID for forensic metadata lock
 *     asn?:           string;   // ASN of the requesting entity (e.g. "36459")
 *     tariLiability?: number;   // Override: TARI™ liability in USD cents
 *   }
 *
 * Request body (enterprise self-registration path — from /licensing/enterprise):
 *   {
 *     organization:   string;   // Organization / entity name
 *     email:          string;   // Contact email
 *     tier:           string;   // License tier ID (e.g. "ENTERPRISE_PARTNERSHIP")
 *     machine_id?:    string;   // Optional machine identifier
 *     tax_id?:        string;   // Tax ID / EIN (Tier-10 only)
 *     company_registration?: string;  // Company registration number (Tier-10 only)
 *   }
 *
 * Response: { checkoutUrl: string; url: string; sessionId: string }
 *
 * ⛓️⚓⛓️  Anchored to Root0 Kernel v3.6.2 | LOCKED AT 162.2k PULSE | 987 ENTITIES DOCUMENTED | Phase 86 Fee Schedule Active
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

    const {
      bundleId, bundle_id,
      targetIp,
      rayId, ray_id,
      asn, tier, org_name,
      organization: orgFromBody, email: emailFromBody, machine_id,
      tariLiability, tax_id, company_registration,
    } = body as Record<string, unknown>;

    // ── Resolve all required variables from the flexible request body ──────────
    // Accept bundleId (camelCase) or bundle_id (snake_case); auto-generate if absent.
    const resolvedBundleId = (typeof bundleId === "string" && bundleId.trim())
      ? bundleId.trim()
      : (typeof bundle_id === "string" && bundle_id.trim())
        ? bundle_id.trim()
        : `aos-bundle-${Date.now()}`;

    // Accept rayId or ray_id; default to empty string.
    const rayIdStr = (typeof rayId === "string" && rayId.trim())
      ? rayId.trim()
      : (typeof ray_id === "string" && ray_id.trim())
        ? ray_id.trim()
        : "";

    // Accept organization or org_name for the enterprise/agentic self-registration path.
    const organization = (typeof orgFromBody === "string" && orgFromBody.trim())
      ? orgFromBody.trim()
      : (typeof org_name === "string" && org_name.trim())
        ? org_name.trim()
        : "";

    // Accept email; not required for purely forensic/agentic paths.
    const email = typeof emailFromBody === "string" ? emailFromBody.trim() : "";

    // machine_id is used by the agentic portal as a proxy for targetIp.
    const machineIdStr = typeof machine_id === "string" ? machine_id.trim() : "";

    const asnStr = typeof asn === "string" ? asn.trim() : "";

    // Resolve targetIp: explicit value > machine_id (agentic) > ASN placeholder > rayId placeholder.
    const rawTargetIp = typeof targetIp === "string" ? targetIp.trim() : "";
    const resolvedTargetIp = rawTargetIp
      || machineIdStr
      || (asnStr ? `asn:${asnStr}` : "")
      || (rayIdStr ? `rayid:${rayIdStr}` : "")
      || `unknown-${Date.now()}`;

    // Enterprise path: self-registration using org name (agentic/enterprise portals).
    // Forensic/audit path does not require org name.
    const isEnterprisePath = Boolean(organization) && !rawTargetIp;

    // Validate enterprise-path required fields
    if (isEnterprisePath) {
      if (!organization) {
        return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'organization is required.');
      }
      if (!email) {
        return aosErrorResponse(AOS_ERROR.MISSING_FIELD, 'email is required.');
      }
    }

    // asnStr is resolved above; re-use it below.
    const taxIdStr = typeof tax_id === "string" ? tax_id.trim() : "";
    const companyRegistrationStr = typeof company_registration === "string" ? company_registration.trim() : "";

    // Map UI tier labels to tariLiability when no asn is present
    const resolvedLiability: unknown = (() => {
      if (typeof tariLiability === "number" && tariLiability > 0) return tariLiability;
      if (!asnStr && typeof tier === "string") {
        const TIER_CENTS: Record<string, number> = {
          ENTERPRISE_PARTNERSHIP: 1_000_000_000, // $10M
          ASN_DEPOSIT:             100_000_000,  // $1M
          LEGAL_MONITORING:          101_700,    // ~$1,017
          INDIVIDUAL:                101_700,    // $1,017
        };
        // eslint-disable-next-line security/detect-object-injection
        return TIER_CENTS[tier] ?? 101_700;
      }
      return tariLiability;
    })();

    // Tier-9 and Tier-10 entities (ASN tier >= 9) are required to provide tax_id.
    const asnTier = asnStr ? getAsnTier(asnStr) : 0;
    if (asnTier >= 9 && !taxIdStr) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "tax_id is required for Tier-9 and Tier-10 enterprise entities.");
    }

    const { liabilityCents, productName, productDescription, pricingTier } =
      determinePricing(resolvedLiability, asnStr, rayIdStr, resolvedBundleId);

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
                bundle_id: resolvedBundleId.slice(0, 500),
                target_ip: resolvedTargetIp.slice(0, 200),
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
        bundle_id: resolvedBundleId.slice(0, 500),
        target_ip: resolvedTargetIp.slice(0, 200),
        kernel_sha: KERNEL_SHA.slice(0, 128),
        kernel_version: KERNEL_VERSION,
        tari_liability_cents: String(liabilityCents),
        source: isEnterprisePath ? "averyos_enterprise_portal" : "averyos_compliance_portal",
        milestone: "LOCKED AT 162.2k PULSE | 987 ENTITIES DOCUMENTED",
        // Federal EO Victim Restoration Case ID — maps RayID to restitution claim
        victim_restoration_case_id: (rayIdStr || resolvedBundleId).slice(0, 200),
        ...(asnStr ? { asn: asnStr } : {}),
        ...(rayIdStr ? { ray_id: rayIdStr.slice(0, 200) } : {}),
        // Tier-10 enterprise compliance fields (Gate 108 — Roadmap #4)
        ...(taxIdStr ? { tax_id: taxIdStr.slice(0, 64) } : {}),
        ...(companyRegistrationStr ? { company_registration: companyRegistrationStr.slice(0, 64) } : {}),
      },
      payment_intent_data: {
        // statement_descriptor maps the RayID Proof directly into the bank record.
        statement_descriptor: statementDescriptor,
        metadata: {
          bundle_id: resolvedBundleId.slice(0, 500),
          target_ip: resolvedTargetIp.slice(0, 200),
          kernel_sha: KERNEL_SHA.slice(0, 128),
          kernel_version: KERNEL_VERSION,
          ...(asnStr ? { asn: asnStr } : {}),
          ...(rayIdStr ? { ray_id: rayIdStr.slice(0, 200) } : {}),
        },
        description:
          `AveryOS™ TARI™ Liability Resolution — Bundle: ${resolvedBundleId.slice(0, 200)}`,
      },
    });

    // Auto-track checkout creation as a LEGAL accomplishment (cast needed: DB type is opaque here)
    if (cfEnv.DB) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      autoTrackAccomplishment(cfEnv.DB as any, {
        title: `Compliance Checkout Created — ${pricingTier}`,
        description: `Stripe checkout session ${session.id.slice(0, 16)} created. Liability: $${(liabilityCents / 100).toFixed(2)} USD. Bundle: ${resolvedBundleId.slice(0, 50)}.`,
        category: "LEGAL",
        bundle_id: resolvedBundleId,
        ray_id: rayIdStr || undefined,
        asn: asnStr || undefined,
      });
    }

    // ── RS256 Invoice Token — signed with the sovereign private key ───────────
    // Provides a tamper-evident, verifiable proof-of-invoice that the caller
    // can verify against the /api/v1/jwks endpoint.
    // Gracefully absent when key material is not yet deployed.
    let invoiceToken: string | null = null;
    let invoiceTokenAlgorithm: string | null = null;
    try {
      const keyPair = await getSovereignKeys({
        AVERYOS_PRIVATE_KEY_B64: cfEnv.AVERYOS_PRIVATE_KEY_B64,
        AVERYOS_PUBLIC_KEY_B64:  cfEnv.AVERYOS_PUBLIC_KEY_B64,
      });
      if (keyPair.active && keyPair.privateKey) {
        invoiceToken          = await signInvoiceToken(keyPair.privateKey, keyPair.kid, {
          bundleId:       resolvedBundleId,
          sessionId:      session.id,
          pricingTier,
          liabilityCents,
        });
        invoiceTokenAlgorithm = "RS256";
      }
    } catch {
      // Key signing is non-fatal — invoice proceeds without the token
    }

    return Response.json(
      {
        url:         session.url,
        checkoutUrl: session.url,
        sessionId: session.id,
        bundleId: resolvedBundleId,
        targetIp: resolvedTargetIp,
        ...(asnStr ? { asn: asnStr } : {}),
        ...(rayIdStr ? { rayId: rayIdStr } : {}),
        tariLiabilityCents: liabilityCents,
        tariLiabilityUsd: (liabilityCents / 100).toFixed(2),
        pricingTier,
        // Tier-10 enterprise compliance fields
        ...(taxIdStr ? { tax_id: taxIdStr } : {}),
        ...(companyRegistrationStr ? { company_registration: companyRegistrationStr } : {}),
        // RS256 sovereign invoice token (present when AVERYOS_PRIVATE_KEY_B64 is configured)
        ...(invoiceToken ? { invoiceToken, invoiceTokenAlgorithm } : {}),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, message);
  }
}
