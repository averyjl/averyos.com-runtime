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
}

/**
 * POST /api/v1/capsules/[capsuleId]/purchase
 *
 * Creates a Stripe Checkout Session for a single capsule license.
 * On successful payment the Stripe webhook activates the license and
 * generates a time-locked download token.
 *
 * Body: { email: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ capsuleId: string }> }
) {
  try {
    const { capsuleId } = await params;

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const stripeKey = cfEnv.STRIPE_SECRET_KEY ?? "";
    if (!stripeKey) {
      return Response.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    }

    // Parse body
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return Response.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
    }

    // Look up capsule
    const capsule = await cfEnv.DB.prepare(
      `SELECT capsule_id, title, tari_fee_usd FROM sovereign_capsules
       WHERE capsule_id = ? AND status = 'ACTIVE'`
    )
      .bind(capsuleId)
      .first();

    if (!capsule) {
      return Response.json({ error: "CAPSULE_NOT_FOUND" }, { status: 404 });
    }

    const feeCents = Math.round(Number(capsule.tari_fee_usd) * 100);

    const stripe = new Stripe(stripeKey);
    const origin = request.headers.get("origin") ?? "https://averyos.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: feeCents,
            product_data: {
              name: `AveryOS™ Capsule — ${String(capsule.title)}`,
              description: `TARI™ Alignment License for capsule: ${String(capsule.capsule_id)}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        capsule_id: String(capsule.capsule_id),
        purchaser_email: email,
      },
      success_url: `${origin}/capsules?licensed=${String(capsule.capsule_id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/capsules`,
    });

    // Insert a PENDING license row so the webhook can update it
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS capsule_licenses (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        capsule_id              TEXT    NOT NULL,
        email                   TEXT    NOT NULL,
        stripe_session_id       TEXT    NOT NULL UNIQUE,
        stripe_payment_intent   TEXT,
        download_token          TEXT    UNIQUE,
        token_expires_at        TEXT,
        licensed_at             TEXT,
        status                  TEXT    NOT NULL DEFAULT 'PENDING'
      )`
    ).run();

    await cfEnv.DB.prepare(
      `INSERT OR IGNORE INTO capsule_licenses
         (capsule_id, email, stripe_session_id, status)
       VALUES (?, ?, ?, 'PENDING')`
    )
      .bind(String(capsule.capsule_id), email, session.id)
      .run();

    return Response.json({ checkout_url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "PURCHASE_ERROR", detail: message }, { status: 500 });
  }
}
