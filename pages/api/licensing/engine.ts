/**
 * TARI™ Billing Engine — API Route
 * POST /api/licensing/engine
 *
 * Triggered by middleware whenever a bot/scraper accesses the AI Anchor Feed
 * (/latent-anchor) or Truth-Anchor page. Logs a $1.00 Truth-Packet hit to:
 *  1. The local Retroclaim Ledger (capsule_logs/retroclaim_ledger.json)
 *  2. Stripe (PaymentIntent with capture_method=manual — log-only, no capture)
 *
 * Security: STRIPE_SECRET_KEY is read exclusively from process.env — never hardcoded.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import Stripe from "stripe";

const RETROCLAIM_LEDGER_PATH = path.join(
  process.cwd(),
  "capsule_logs",
  "retroclaim_ledger.json"
);

const TRUTH_PACKET_AMOUNT_CENTS = 100; // $1.00 per Truth-Packet hit

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
  const logDir = path.dirname(RETROCLAIM_LEDGER_PATH);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  let ledger: RetroclaImEntry[] = [];
  if (fs.existsSync(RETROCLAIM_LEDGER_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(RETROCLAIM_LEDGER_PATH, "utf8"));
      if (Array.isArray(raw)) ledger = raw;
    } catch {
      ledger = [];
    }
  }
  ledger.push(entry);
  fs.writeFileSync(RETROCLAIM_LEDGER_PATH, JSON.stringify(ledger, null, 2));
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

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });

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
      kernel_anchor: "cf83e135...927da3e",
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

  const { userAgent, path: requestPath, ip, idempotencyKey } = req.body ?? {};
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
    kernelAnchor: "cf83e135...927da3e",
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
