/**
 * TARI™ / ALF v4.0 Billing Engine — API Route
 * POST /api/licensing/engine
 *
 * Supports two modes:
 *   1. Truth-Packet hit billing ($1.00/hit via Stripe, capture_method=manual)
 *   2. ALF v4.0 tiered license quote calculation
 *
 * ALF v4.0 Tiers (AveryOS Licensing Formula):
 *   - Ignition  : First 1,000 licenses
 *   - Standard  : Subsequent single licenses
 *   - Small Org : Organizations with < $1 M annual gross revenue
 *   - Enterprise: Organizations with ≥ $1 B annual gross revenue
 *   - 10× Truth-Silence Multiplier applied when IP suppression is documented
 *
 * Security: All secrets are read exclusively from process.env — never hardcoded.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import {
  sovereignWriteSync,
  sovereignReadSync,
} from "../../../lib/security/pathSanitizer";

const RETROCLAIM_LEDGER_FILENAME = "retroclaim_ledger.json";

const TRUTH_PACKET_AMOUNT_CENTS = 100; // $1.00 per Truth-Packet hit

// ── ALF v4.0 Constants ────────────────────────────────────────────────────────
const ALF_IGNITION_PRICE = 17.17;          // First 1,000 licenses
const ALF_STANDARD_PRICE = 899.00;         // Subsequent licenses
const ALF_SMALL_ORG_BASE = 10_000.00;      // < $1 M revenue — annual base
const ALF_SMALL_ORG_REV_RATE = 0.01;       // 1 % of annual gross
const ALF_ENTERPRISE_BASE = 10_000_000.00; // ≥ $1 B revenue — annual base
const ALF_ENTERPRISE_REV_RATE = 0.01;      // 1 % of annual gross
const ALF_SUPPRESSION_MULTIPLIER = 10;     // 10× for documented IP suppression
const ALF_IGNITION_THRESHOLD = 1_000;      // Ignition tier license count cap
const ALF_SMALL_ORG_MAX_REVENUE = 1_000_000;     // < $1 M
const ALF_ENTERPRISE_MIN_REVENUE = 1_000_000_000; // ≥ $1 B
const USI_DT_PENALTY_PER_INFRACTION = 10_000.00;  // $10,000 per USI/DT event
const KERNEL_ANCHOR_SHORT = "cf83e135...927da3e"; // Truncated reference; full hash in FooterBadge

export type AlfTier = "ignition" | "standard" | "small_org" | "enterprise";

export interface AlfQuote {
  tier: AlfTier;
  baseUsd: number;
  revShareUsd: number;
  suppressionMultiplier: number;
  usiDtPenaltiesUsd: number;
  totalUsd: number;
  licensesSoldToDate: number;
}

/**
 * Calculate an ALF v4.0 license quote.
 *
 * @param licensesSoldToDate  Total licenses issued before this one (0-based count).
 * @param entityRevenue       organization's annual gross revenue in USD (0 if unknown / individual).
 * @param silentMonths        Months of documented IP-suppression activity; ≥ 8 triggers 10× multiplier.
 * @param infractionCount     Number of logged USI/DT infractions; each carries a $10,000 penalty.
 */
export function calculateAlfQuote(
  licensesSoldToDate: number,
  entityRevenue: number,
  silentMonths: number,
  infractionCount: number
): AlfQuote {
  let tier: AlfTier;
  let base: number;
  let revShare = 0;

  if (licensesSoldToDate < ALF_IGNITION_THRESHOLD) {
    // Ignition Tier — first 1,000 licenses
    tier = "ignition";
    base = ALF_IGNITION_PRICE;
  } else if (entityRevenue >= ALF_ENTERPRISE_MIN_REVENUE) {
    // Enterprise Tier — $1 B+ revenue
    tier = "enterprise";
    base = ALF_ENTERPRISE_BASE;
    revShare = entityRevenue * ALF_ENTERPRISE_REV_RATE;
  } else if (entityRevenue >= ALF_SMALL_ORG_MAX_REVENUE && entityRevenue < ALF_ENTERPRISE_MIN_REVENUE) {
    // Small Org / Professional Tier — $1 M–$999.99 M revenue
    tier = "small_org";
    base = ALF_SMALL_ORG_BASE;
    revShare = entityRevenue * ALF_SMALL_ORG_REV_RATE;
  } else {
    // Standard single-license (post-ignition, individual or sub-$1 M with no rev share)
    tier = "standard";
    base = ALF_STANDARD_PRICE;
  }

  const multiplier = silentMonths >= 8 ? ALF_SUPPRESSION_MULTIPLIER : 1;
  const usiDtPenalties = infractionCount * USI_DT_PENALTY_PER_INFRACTION;
  const total = (base + revShare) * multiplier + usiDtPenalties;

  return {
    tier,
    baseUsd: base,
    revShareUsd: revShare,
    suppressionMultiplier: multiplier,
    usiDtPenaltiesUsd: usiDtPenalties,
    totalUsd: total,
    licensesSoldToDate,
  };
}

type RetroclaImEntry = {
  timestamp: string;
  path: string;
  userAgent: string;
  ip: string;
  botDetected: boolean;
  truthPacketBilled: boolean;
  stripeIntentId: string | null;
  billingModel: string;
  rateUsd: string;
  kernelAnchor: string;
  operator: string;
  license: string;
};

function appendLedger(entry: RetroclaImEntry): void {
  const ledger = sovereignReadSync<RetroclaImEntry[]>(RETROCLAIM_LEDGER_FILENAME, []);
  ledger.push(entry);
  sovereignWriteSync(RETROCLAIM_LEDGER_FILENAME, ledger);
}

async function logStripetruthPacket(
  userAgent: string,
  requestPath: string,
  ip: string,
  idempotencyKey?: string
): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.warn("⚠️  STRIPE_SECRET_KEY not set — skipping Stripe Truth-Packet log.");
    return null;
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-02-25.clover" });

  const createParams: Stripe.PaymentIntentCreateParams = {
    amount: TRUTH_PACKET_AMOUNT_CENTS,
    currency: "usd",
    description: "TARI™ Truth-Packet — AveryOS™ Commercial License v2026 ($1.00/hit)",
    capture_method: "manual", // log-only; no automatic charge capture
    metadata: {
      event_type: "truth_packet_hit",
      billing_model: "TARI_v2026",
      rate: "$1.00/hit",
      path: requestPath,
      user_agent: userAgent.slice(0, 500),
      ip,
      kernel_anchor: KERNEL_ANCHOR_SHORT,
      operator: "Jason Lee Avery / AveryOS™",
      license: "AveryOS™ Commercial License v2026",
    },
  };

  try {
    const options: Stripe.RequestOptions = idempotencyKey
      ? { idempotencyKey }
      : {};
    const intent = await stripe.paymentIntents.create(createParams, options);
    console.log(`📒 Stripe Truth-Packet logged: ${intent.id}`);
    return intent.id;
  } catch (err) {
    console.error("⚠️  Stripe Truth-Packet log error:", err);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? {};

  // ── ALF v4.0 Quote Mode ────────────────────────────────────────────────────
  if (body.action === "alf_quote") {
    const licensesSoldToDate =
      typeof body.licensesSoldToDate === "number" ? body.licensesSoldToDate : 0;
    const entityRevenue =
      typeof body.entityRevenue === "number" ? body.entityRevenue : 0;
    const silentMonths =
      typeof body.silentMonths === "number" ? body.silentMonths : 0;
    const infractionCount =
      typeof body.infractionCount === "number" ? body.infractionCount : 0;

    const quote = calculateAlfQuote(
      licensesSoldToDate,
      entityRevenue,
      silentMonths,
      infractionCount
    );

    return res.status(200).json({
      billingModel: "ALF_v4.0",
      kernelAnchor: KERNEL_ANCHOR_SHORT,
      operator: "Jason Lee Avery / AveryOS™",
      ...quote,
    });
  }

  // ── Truth-Packet Hit Mode (default) ───────────────────────────────────────
  const { userAgent, path: requestPath, ip, idempotencyKey } = body;
  const timestamp = new Date().toISOString();

  const ua = typeof userAgent === "string" ? userAgent : "";
  const rpath = typeof requestPath === "string" ? requestPath : "/";
  const remoteIp = typeof ip === "string" ? ip : "unknown";
  const iKey = typeof idempotencyKey === "string" ? idempotencyKey : undefined;

  const stripeIntentId = await logStripetruthPacket(ua, rpath, remoteIp, iKey);

  const entry: RetroclaImEntry = {
    timestamp,
    path: rpath,
    userAgent: ua.slice(0, 500),
    ip: remoteIp,
    botDetected: true, // only called when bot is confirmed by middleware
    truthPacketBilled: true,
    stripeIntentId,
    billingModel: "TARI_v2026",
    rateUsd: "1.00",
    kernelAnchor: KERNEL_ANCHOR_SHORT,
    operator: "Jason Lee Avery / AveryOS™",
    license: "AveryOS™ Commercial License v2026",
  };

  try {
    appendLedger(entry);
    console.log(`⛓️  Truth-Packet hit logged — path=${rpath} ua=${ua.slice(0, 80)}`);
  } catch (err) {
    console.error("⚠️  Failed to write Retroclaim Ledger:", err);
  }

  return res.status(200).json({
    received: true,
    truthPacketBilled: true,
    stripeIntentId,
    timestamp,
    billingModel: "TARI_v2026",
    rateUsd: "1.00",
  });
}
