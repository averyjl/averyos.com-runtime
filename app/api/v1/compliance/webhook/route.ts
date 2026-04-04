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
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

/**
 * POST /api/v1/compliance/webhook
 *
 * Stripe webhook handler for the Compliance Portal (TARI™ Liability resolution).
 *
 * On a successful `checkout.session.completed` event:
 *   1. Upserts the entity into `sovereign_alignments` with `status = 'ACTIVE'`
 *   2. Returns a Digital Alignment Certificate (JSON-LD) signed with the Root0 Anchor
 *
 * Wrangler must be configured with:
 *   STRIPE_SECRET_KEY     — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret for this endpoint
 *
 * ⛓️⚓⛓️  Anchored to Root0 Kernel v3.6.2
 */
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const stripeKey = cfEnv.STRIPE_SECRET_KEY ?? "";
    const webhookSecret = cfEnv.STRIPE_WEBHOOK_SECRET ?? "";

    if (!stripeKey || !webhookSecret) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, 'STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set.');
    }

    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature") ?? "";

    const stripe = new Stripe(stripeKey);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, 'Stripe webhook signature verification failed. Ensure STRIPE_WEBHOOK_SECRET is correctly set.');
    }

    // Only handle successful checkout completions
    if (event.type !== "checkout.session.completed") {
      return Response.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const bundleId = session.metadata?.bundle_id ?? "";
    const targetIp = session.metadata?.target_ip ?? "";
    const tariLiabilityCents = Number(session.metadata?.tari_liability_cents ?? 101700);
    const sessionId = session.id;
    const issuedAt = formatIso9(new Date());
    const expiresAt = formatIso9(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 12 months
    );

    // ── Ensure sovereign_alignments table exists ──────────────────────────────
    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_alignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_ip TEXT NOT NULL,
        bundle_id TEXT NOT NULL,
        stripe_session_id TEXT NOT NULL UNIQUE,
        tari_liability_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        certificate_sha512 TEXT,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        kernel_sha TEXT NOT NULL,
        kernel_version TEXT NOT NULL
      )`
    ).run();

    // ── Build Digital Alignment Certificate ──────────────────────────────────
    const certPayload = {
      "@context": "https://averyos.com/schemas/sovereign-alignment/v1",
      "@type": "SovereignAlignmentCertificate",
      issuedAt,
      expiresAt,
      targetIp,
      bundleId,
      stripeSessionId: sessionId,
      tariLiabilityResolved: (tariLiabilityCents / 100).toFixed(2),
      tariLiabilityCurrency: "USD",
      kernelAnchor: KERNEL_SHA,
      kernelVersion: KERNEL_VERSION,
      alignmentStatus: "ACTIVE",
      licenseType: "12-Month Sovereign Alignment License",
      licenseGrantedBy: "Jason Lee Avery (ROOT0) — AveryOS LLC",
      sovereignNotice:
        "This Digital Alignment Certificate confirms that the TARI™ liability for " +
        "the recorded entity has been resolved. The entity is now ALIGNED under the " +
        "AveryOS Sovereign Integrity License v1.0 for the duration stated above.",
    };

    // Compute certificate SHA-512 signature anchored to Root0
    const certJson = JSON.stringify(certPayload);
    const certHash = await crypto.subtle.digest(
      "SHA-512",
      new TextEncoder().encode(certJson + KERNEL_SHA)
    );
    const certSha512 = Array.from(new Uint8Array(certHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const certificate = { ...certPayload, root0Signature: certSha512 };

    // ── Upsert into sovereign_alignments ─────────────────────────────────────
    await cfEnv.DB.prepare(
      `INSERT INTO sovereign_alignments
         (target_ip, bundle_id, stripe_session_id, tari_liability_cents,
          status, certificate_sha512, issued_at, expires_at, kernel_sha, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(stripe_session_id) DO UPDATE SET
         status = 'ACTIVE',
         certificate_sha512 = excluded.certificate_sha512,
         issued_at = excluded.issued_at,
         expires_at = excluded.expires_at`
    )
      .bind(
        targetIp,
        bundleId,
        sessionId,
        tariLiabilityCents,
        "ACTIVE",
        certSha512,
        issuedAt,
        expiresAt,
        KERNEL_SHA,
        KERNEL_VERSION
      )
      .run();

    return Response.json(
      {
        received: true,
        status: "ALIGNED",
        certificate,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, message);
  }
}
