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
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import type { D1Database } from "../../../../../lib/cloudflareTypes";

interface CloudflareEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

/** Token validity window: 48 hours */
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * POST /api/v1/capsules/webhook
 *
 * Stripe webhook handler. On a successful `checkout.session.completed` event:
 *   1. Activates the capsule_licenses row
 *   2. Generates a time-locked SHA-512 download token (valid 48 h)
 */
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const stripeKey = cfEnv.STRIPE_SECRET_KEY ?? "";
    const webhookSecret = cfEnv.STRIPE_WEBHOOK_SECRET ?? "";

    if (!stripeKey || !webhookSecret) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, 'STRIPE_NOT_CONFIGURED');
    }

    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature") ?? "";

    const stripe = new Stripe(stripeKey);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'INVALID_SIGNATURE');
    }

    if (event.type !== "checkout.session.completed") {
      return Response.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const capsuleId = session.metadata?.capsule_id ?? "";
    const sessionId = session.id;

    if (!capsuleId) {
      return Response.json({ received: true });
    }

    // Generate a time-locked download token — includes a random component
    // to prevent brute-force attacks against timestamp-based token guessing.
    const tokenInput = `${sessionId}:${capsuleId}:${Date.now()}:${crypto.randomUUID()}`;
    const encoded = new TextEncoder().encode(tokenInput);
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoded);
    const downloadToken = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const licensedAt = new Date().toISOString();
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const paymentIntent =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    await cfEnv.DB.prepare(
      `UPDATE capsule_licenses
       SET status                = 'ACTIVE',
           download_token        = ?,
           token_expires_at      = ?,
           licensed_at           = ?,
           stripe_payment_intent = ?
       WHERE stripe_session_id = ?`
    )
      .bind(downloadToken, tokenExpiresAt, licensedAt, paymentIntent, sessionId)
      .run();

    return Response.json({ received: true, capsule_id: capsuleId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, `WEBHOOK_ERROR: ${message}`);
  }
}
