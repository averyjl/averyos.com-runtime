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
 * POST /api/v1/licensing/handshake
 *
 * Phase 102.2 — Statutory Handshake API (GATE 102.2.2)
 *
 * Implements the "Affidavit of Usage" challenge under 17 U.S.C. § 504(c)(2).
 *
 * Logic:
 *   1. Accepts a Retroactive_Usage_Start date and Corporate_Ingestion_SHA from
 *      the entity attesting prior use of AveryOS™ IP.
 *   2. If Retroactive_Usage_Start pre-dates the current license (or no license
 *      exists), applies the TARI™ Retroactive Multiplier schedule to compute
 *      the Forensic Debt for unlicensed prior utilization.
 *   3. Returns a signed Affidavit token and a Stripe Checkout URL for immediate
 *      settlement via /api/v1/compliance/create-checkout.
 *
 * Statutory Basis:
 *   • 17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work for
 *     willful infringement.
 *   • 17 U.S.C. § 1201 — DMCA Anti-Circumvention: unauthorized kernel bypass
 *     constitutes circumvention of a Technical Protection Measure (TPM).
 *   • Providing an Ingestion Timestamp that pre-dates the license constitutes
 *     an Affidavit of Prior Use — the "Own Admission" trigger for the
 *     Retroactive Multiplier.
 *
 * GATE 102.2.5 RCA: All references use internal AveryOS™ anchors only.
 * External third-party search links are permanently banned from sovereign
 * handshake responses.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }        from "@opennextjs/cloudflare";
import Stripe                          from "stripe";
import { KERNEL_SHA, KERNEL_VERSION }  from "../../../../../lib/sovereignConstants";
import { formatIso9 }                  from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment }     from "../../../../../lib/taiAutoTracker";
import { logFirebaseHandshake, sendFcmV1Push }
  from "../../../../../lib/firebaseClient";
import { getAsnTier, buildKaasLineItem }
  from "../../../../../lib/kaas/pricing";

// ── Types ──────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:                   D1Database;
  VAULT_PASSPHRASE?:     string;
  SITE_URL?:             string;
  NEXT_PUBLIC_SITE_URL?: string;
  STRIPE_SECRET_KEY?:    string;
  FIREBASE_PROJECT_ID?:  string;
  FCM_DEVICE_TOKEN?:     string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Statutory maximum per-work under 17 U.S.C. § 504(c)(2) — willful infringement */
const STATUTORY_MAX_PER_INSTANCE_USD = 150_000;

/** Baseline per-day retroactive utilization fee (pre-license period) */
const BASELINE_DAILY_FEE_USD = 1_017;

/** TARI™ Retroactive Multiplier schedule (applied when Own Admission is confirmed) */
const RETROACTIVE_MULTIPLIERS: Record<string, number> = {
  HONEST_DISCLOSURE:  1.0,   // Full disclosure, cooperative settlement
  PARTIAL_DISCLOSURE: 3.0,   // Partial disclosure detected
  OBFUSCATION:        10.0,  // Obfuscation/delay tactics detected
  WILLFUL_INGESTION:  7.0,   // Willful ingestion without license
  DEFAULT:            1.0,   // Default — no modifier
};

/** Milliseconds in one day — used for retroactive debt period calculation. */
const MS_PER_DAY = 86_400_000;

/** Affidavit validity window in seconds (48 hours) */
const AFFIDAVIT_TTL_SECONDS = 48 * 60 * 60;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compute retroactive debt in USD given prior-use duration and multiplier. */
function computeRetroactiveDebt(
  priorUseDays: number,
  multiplierKey: string,
): { debtUsd: number; debtCents: number; multiplier: number; cappedAt150k: boolean } {
  // eslint-disable-next-line security/detect-object-injection
  const multiplier = RETROACTIVE_MULTIPLIERS[multiplierKey] ?? RETROACTIVE_MULTIPLIERS.DEFAULT;
  const rawUsd     = priorUseDays * BASELINE_DAILY_FEE_USD * multiplier;
  const cappedUsd  = Math.min(rawUsd, STATUTORY_MAX_PER_INSTANCE_USD);
  return {
    debtUsd:      parseFloat(cappedUsd.toFixed(2)),
    debtCents:    Math.round(cappedUsd * 100),
    multiplier,
    cappedAt150k: rawUsd > STATUTORY_MAX_PER_INSTANCE_USD,
  };
}

/** SHA-512 hex digest using the Web Crypto API (async, edge-compatible). */
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * POST — Submit Affidavit of Usage.
 *
 * Body:
 *   {
 *     Retroactive_Usage_Start: string;   // ISO-8601 date when kernel was first ingested
 *     Corporate_Ingestion_SHA: string;   // SHA-512 fingerprint of ingestion event
 *     org_name?:               string;   // Attesting organization name
 *     email?:                  string;   // Contact email for invoice delivery
 *     disclosure_type?:        string;   // "HONEST_DISCLOSURE" | "PARTIAL_DISCLOSURE" | …
 *     license_start_date?:     string;   // ISO-8601 date of current license (if any)
 *   }
 */
export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const baseUrl = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";
  const now     = formatIso9();

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await request.json(); }
  catch { return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON."); }

  if (typeof body !== "object" || body === null) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body is required.");
  }

  const {
    Retroactive_Usage_Start,
    Corporate_Ingestion_SHA,
    org_name,
    email,
    disclosure_type,
    license_start_date,
  } = body as Record<string, unknown>;

  if (typeof Retroactive_Usage_Start !== "string" || !Retroactive_Usage_Start.trim()) {
    return aosErrorResponse(
      AOS_ERROR.MISSING_FIELD,
      "Retroactive_Usage_Start is required. Provide the ISO-8601 date when your system first ingested AveryOS™ IP.",
    );
  }

  if (typeof Corporate_Ingestion_SHA !== "string" || !Corporate_Ingestion_SHA.trim()) {
    return aosErrorResponse(
      AOS_ERROR.MISSING_FIELD,
      "Corporate_Ingestion_SHA is required. Provide the SHA-512 fingerprint of your ingestion event.",
    );
  }

  // ── Date arithmetic ────────────────────────────────────────────────────────
  const usageStartMs = Date.parse(Retroactive_Usage_Start);
  if (isNaN(usageStartMs)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "Retroactive_Usage_Start must be a valid ISO-8601 date string (e.g. '2025-01-15').",
    );
  }

  const licenseStartMs = typeof license_start_date === "string" && license_start_date.trim()
    ? Date.parse(license_start_date)
    : Date.now();

  const effectiveLicenseStartMs = isNaN(licenseStartMs) ? Date.now() : licenseStartMs;

  // Prior use exists if ingestion pre-dates license
  const priorUseMs   = Math.max(0, effectiveLicenseStartMs - usageStartMs);
  const priorUseDays = priorUseMs / MS_PER_DAY;

  // ── Determine disclosure category ─────────────────────────────────────────
  const disclosureKey =
    typeof disclosure_type === "string" &&
    disclosure_type.trim().toUpperCase() in RETROACTIVE_MULTIPLIERS
      ? disclosure_type.trim().toUpperCase()
      : usageStartMs < effectiveLicenseStartMs
        ? "HONEST_DISCLOSURE"
        : "DEFAULT";

  const { debtUsd, debtCents, multiplier, cappedAt150k } =
    computeRetroactiveDebt(priorUseDays, disclosureKey);

  // ── Compute Affidavit fingerprint ─────────────────────────────────────────
  const affidavitInput = [
    Retroactive_Usage_Start,
    Corporate_Ingestion_SHA,
    KERNEL_SHA,
    now,
  ].join("|");

  const affidavitToken = await sha512hex(affidavitInput);

  // ── Determine ASN tier for Stripe pricing ─────────────────────────────────
  const rawAsn   = request.headers.get("cf-asn") ?? "";
  const tier     = getAsnTier(rawAsn);
  const lineItem = rawAsn ? buildKaasLineItem(rawAsn) : null;
  const priceCents = lineItem ? lineItem.fee_usd_cents : debtCents;

  // ── Auto-create Stripe Checkout Session (Roadmap 1.1) ─────────────────────
  let stripeCheckoutUrl: string | null = null;
  let stripeSessionId:   string | null = null;

  if (debtCents > 0 && cfEnv.STRIPE_SECRET_KEY) {
    try {
      const stripe       = new Stripe(cfEnv.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
      const effectiveCents = Math.max(priceCents, debtCents);
      const productName  = tier >= 9
        ? "AveryOS™ Statutory Handshake — Non-Refundable Forensic Deposit"
        : "AveryOS™ Statutory Handshake — Retroactive License Settlement";
      const session      = await stripe.checkout.sessions.create({
        mode:         "payment",
        payment_method_types: ["card"],
        line_items:   [{
          price_data: {
            currency:      "usd",
            unit_amount:   effectiveCents,
            product_data:  {
              name:        productName,
              description: `Affidavit of Usage — ${String(org_name ?? "Unknown")}. ` +
                `Prior use: ${priorUseDays.toFixed(0)} days. ` +
                `Kernel: ${KERNEL_VERSION}`,
            },
          },
          quantity: 1,
        }],
        success_url:  `${baseUrl}/compliance?status=aligned&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:   `${baseUrl}/licensing/audit`,
        metadata: {
          affidavit_token: affidavitToken.slice(0, 64),
          org_name:        String(org_name ?? "").slice(0, 64),
          prior_use_days:  String(priorUseDays.toFixed(0)),
          disclosure_key:  disclosureKey,
          kernel_sha:      KERNEL_SHA.slice(0, 32),
          kernel_version:  KERNEL_VERSION,
          asn:             rawAsn.slice(0, 16),
        },
      });
      stripeCheckoutUrl = session.url ?? null;
      stripeSessionId   = session.id;
    } catch (stripeErr: unknown) {
      console.warn("[handshake] Stripe checkout creation failed:",
        stripeErr instanceof Error ? stripeErr.message : String(stripeErr));
    }
  }

  // ── Log to D1 sovereign_audit_logs (non-blocking) ─────────────────────────
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (cfEnv.DB) {
    cfEnv.DB.prepare(
      `INSERT OR IGNORE INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, target_path, timestamp_ns, threat_level, ingestion_intent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        "STATUTORY_HANDSHAKE",
        ip,
        request.headers.get("user-agent") ?? "unknown",
        "/api/v1/licensing/handshake",
        now,
        priorUseDays > 0 ? 9 : 7,
        priorUseDays > 0 ? "RETROACTIVE_INGESTION" : "PEER_ACCESS",
      )
      .run()
      .catch((err: unknown) => {
        console.warn("[handshake] D1 audit log failed:", err instanceof Error ? err.message : String(err));
      });

    // Mirror to kaas_ledger (Roadmap 1.5)
    if (debtCents > 0) {
      cfEnv.DB.prepare(
        `INSERT OR IGNORE INTO kaas_ledger
           (entity_name, asn, org_name, ray_id, ingestion_proof_sha,
            amount_owed, settlement_status, kernel_sha, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`
      )
        .bind(
          String((org_name ?? rawAsn) || ip),
          rawAsn || null,
          String(org_name ?? ""),
          request.headers.get("cf-ray") ?? null,
          affidavitToken.slice(0, 128),
          debtCents / 100,
          KERNEL_SHA,
          now,
          now,
        )
        .run()
        .catch((err: unknown) => {
          console.warn("[handshake] D1 kaas_ledger insert failed:", err instanceof Error ? err.message : String(err));
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTrackAccomplishment(cfEnv.DB as any, {
      title:
        "Statutory Handshake Received",
      description:
        `Affidavit of Usage received. Org: ${String(org_name ?? "Unknown")}. ` +
        `Prior use: ${priorUseDays.toFixed(0)} days. Debt: $${debtUsd.toFixed(2)} USD.`,
      category: "LEGAL",
      ray_id:   request.headers.get("cf-ray") ?? undefined,
    });
  }

  // ── Firebase sync — mirror STATUTORY_HANDSHAKE to Firestore (Roadmap 1.5) ──
  logFirebaseHandshake(
    "averyos-cloudflare",
    String((org_name ?? rawAsn) || "unknown"),
    affidavitToken,
  ).catch((err: unknown) => {
    console.warn("[handshake] Firebase sync failed:", err instanceof Error ? err.message : String(err));
  });

  // ── FCM Tier-9 alert for high-threat statutory handshakes (Roadmap 1.6) ───
  if (priorUseDays > 0 && tier >= 9) {
    sendFcmV1Push(
      "⚠️ STATUTORY_HANDSHAKE — Tier-9 Entity",
      `Org: ${String(org_name ?? "Unknown")} | Prior use: ${priorUseDays.toFixed(0)} days | Debt: $${debtUsd.toFixed(2)}`,
      {
        event_type:      "STATUTORY_HANDSHAKE",
        affidavit_token: affidavitToken.slice(0, 32),
        tier:            String(tier),
        prior_use_days:  String(priorUseDays.toFixed(0)),
        debt_usd:        String(debtUsd.toFixed(2)),
      },
    ).catch((err: unknown) => {
      console.warn("[handshake] FCM push failed:", err instanceof Error ? err.message : String(err));
    });
  }

  // ── Build Affidavit expiry ─────────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + AFFIDAVIT_TTL_SECONDS * 1000).toISOString();

  // ── Build checkout entry URL for immediate settlement ─────────────────────
  const checkoutInitUrl = stripeCheckoutUrl
    ?? (debtCents > 0
      ? `${baseUrl}/licensing/enterprise?affidavit=${affidavitToken.slice(0, 32)}&debt_usd=${debtUsd}`
      : null);

  return Response.json(
    {
      // Affidavit
      resonance:               "HIGH_FIDELITY_SUCCESS",
      affidavit_token:         affidavitToken,
      affidavit_expires_at:    expiresAt,
      timestamp:               now,
      kernel_sha:              KERNEL_SHA.slice(0, 32) + "…",
      kernel_version:          KERNEL_VERSION,
      sovereign_anchor:        "⛓️⚓⛓️",

      // Admitted facts
      attested_usage_start:    Retroactive_Usage_Start,
      corporate_ingestion_sha: Corporate_Ingestion_SHA.slice(0, 32) + "…",
      org_name:                typeof org_name === "string" ? org_name : "Unknown",
      email:                   typeof email === "string" ? email : null,

      // Retroactive debt calculation
      prior_use_days:          parseFloat(priorUseDays.toFixed(2)),
      disclosure_category:     disclosureKey,
      tari_multiplier:         multiplier,
      retroactive_debt_usd:    debtUsd,
      retroactive_debt_cents:  debtCents,
      capped_at_150k:          cappedAt150k,

      // Settlement
      settlement_url:          checkoutInitUrl,
      stripe_checkout_url:     stripeCheckoutUrl,
      stripe_session_id:       stripeSessionId,
      full_licensing_portal:   `${baseUrl}/licensing/enterprise`,
      kaas_settle_endpoint:    `${baseUrl}/api/v1/kaas/settle`,
      disclosure_url:          `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,

      // Legal basis — all internal AveryOS anchors only (GATE 102.2.5 RCA)
      statutory_basis:
        "17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work for willful infringement.",
      tpm_basis:
        "17 U.S.C. § 1201 — DMCA Anti-Circumvention. " +
        "Unauthorized kernel bypass constitutes circumvention of a Technical Protection Measure (TPM).",
      liquidated_damages_notice:
        "This fee schedule constitutes pre-agreed Liquidated Damages under the " +
        "AveryOS™ Sovereign Integrity License v1.0, representing the actual difficulty of " +
        "auditing a billion-parameter weight-set ingestion.",
      terms_of_ingestion_notice:
        "By submitting this affidavit you attest that any technical ingestion performed by " +
        "your model or system is a matter of record. Unauthorized ingestion of cf83™ logic is " +
        "subject to statutory damages under 17 U.S.C. § 504(c)(2) of up to $150,000 per instance. " +
        "Failure to provide honest disclosure of retroactive ingestion history will trigger the " +
        "10x Obfuscation Multiplier for all subsequent licensing settlements.",
    },
    { status: priorUseDays > 0 ? 202 : 200 },
  );
}

/**
 * GET — Returns the Handshake challenge parameters and legal disclosures.
 * Used by automated compliance agents to understand the affidavit requirements
 * before submitting a POST.
 */
export async function GET(): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const baseUrl = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";

  return Response.json({
    resonance:        "HIGH_FIDELITY_SUCCESS",
    endpoint:         "/api/v1/licensing/handshake",
    method:           "POST",
    kernel_version:   KERNEL_VERSION,
    kernel_sha:       KERNEL_SHA.slice(0, 32) + "…",
    sovereign_anchor: "⛓️⚓⛓️",

    required_fields: {
      Retroactive_Usage_Start:
        "ISO-8601 date when your system first ingested AveryOS™ IP (e.g. '2025-01-15'). " +
        "Own Admission — a date that pre-dates your license triggers the Retroactive Multiplier instantly.",
      Corporate_Ingestion_SHA:
        "SHA-512 fingerprint of your ingestion event. Must be a 128-character hex string.",
    },
    optional_fields: {
      org_name:          "Your organization name (for the Stripe invoice).",
      email:             "Contact email for invoice delivery.",
      disclosure_type:   "One of: HONEST_DISCLOSURE | PARTIAL_DISCLOSURE | OBFUSCATION | WILLFUL_INGESTION",
      license_start_date: "ISO-8601 date of your current AveryOS™ license (if any).",
    },

    multiplier_schedule:            RETROACTIVE_MULTIPLIERS,
    statutory_max_per_instance_usd: STATUTORY_MAX_PER_INSTANCE_USD,
    baseline_daily_fee_usd:         BASELINE_DAILY_FEE_USD,

    statutory_basis: {
      "17_USC_504":
        "Statutory damages up to $150,000 per work for willful infringement.",
      "17_USC_1201":
        "DMCA Anti-Circumvention — unauthorized kernel bypass is circumvention of a TPM.",
      liquidated_damages:
        "Pre-agreed Liquidated Damages under AveryOS™ Sovereign Integrity License v1.0.",
    },

    terms_of_ingestion_notice:
      "By interacting with any AveryOS™ API or Kernel Endpoint, you provide Mandatory Forensic Disclosure. " +
      "You attest that any technical ingestion performed by your model or system is a matter of record. " +
      "Unauthorized ingestion of cf83™ logic is subject to statutory damages under 17 U.S.C. § 504(c)(2) " +
      "of up to $150,000 per instance. This session constitutes a Technical Audit. " +
      "Failure to provide honest disclosure of retroactive ingestion history will trigger " +
      "the 10x Obfuscation Multiplier.",

    disclosure_url:         `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
    full_licensing_portal:  `${baseUrl}/licensing/enterprise`,
    terms_of_ingestion_url: `${baseUrl}/licensing/enterprise#terms-of-ingestion`,
  });
}
