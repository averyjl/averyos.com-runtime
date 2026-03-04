import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first(): Promise<Record<string, unknown> | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

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
      return Response.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    }

    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature") ?? "";

    const stripe = new Stripe(stripeKey);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch {
      return Response.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
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
    return Response.json({ error: "WEBHOOK_ERROR", detail: message }, { status: 500 });
  }
}
