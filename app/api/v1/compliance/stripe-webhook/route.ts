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
 * POST /api/v1/compliance/stripe-webhook
 *
 * Stripe Webhook Centralization — Phase 93.1 / 94.4 / 95.3
 *
 * Re-implements the legacy Render stripe_listener logic as a Cloudflare Worker
 * endpoint, eliminating the third-party Render dependency and placing the
 * Stripe Ledger and D1 Database in the same data-center.
 *
 * Handles:
 *   • checkout.session.completed — activates capsule_access_tokens + sovereign_alignments
 *   • customer.subscription.created / updated / deleted — subscription lifecycle
 *   • payment_intent.succeeded — payment confirmation + R2 evidence download link
 *   • payment_intent.payment_failed — failed payment logging
 *
 * Wrangler secrets required:
 *   STRIPE_SECRET_KEY         — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET     — Stripe webhook signing secret for this endpoint
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
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

interface R2Bucket {
  get(key: string): Promise<{ body: ReadableStream } | null>;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_R2?: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SITE_URL?: string;
}

/** Compute a SHA-512 hex digest */
async function sha512hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a time-limited secure download token for the R2 evidence bundle.
 * The token is a SHA-512 of the payment_intent ID + KERNEL_SHA + current
 * 5-minute window, making it valid for up to 5 minutes without DB storage.
 */
async function generateEvidenceToken(piId: string): Promise<string> {
  const windowMs = 5 * 60 * 1000;
  const window   = Math.floor(Date.now() / windowMs);
  return sha512hex(`evidence_token:${piId}:${window}:${KERNEL_SHA}`);
}

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const stripeKey     = cfEnv.STRIPE_SECRET_KEY ?? "";
    const webhookSecret = cfEnv.STRIPE_WEBHOOK_SECRET ?? "";

    if (!stripeKey || !webhookSecret) {
      return aosErrorResponse(
        AOS_ERROR.VAULT_NOT_CONFIGURED,
        "STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set.",
      );
    }

    const rawBody = await request.text();
    const sig     = request.headers.get("stripe-signature") ?? "";
    const stripe  = new Stripe(stripeKey);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch (verifyErr: unknown) {
      console.error("[STRIPE_WEBHOOK] Signature verification failed:", verifyErr instanceof Error ? verifyErr.message : String(verifyErr));
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Stripe webhook signature verification failed.");
    }

    const receivedAt = formatIso9(new Date());

    // ── checkout.session.completed ────────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session    = event.data.object as Stripe.Checkout.Session;
      const sessionId  = session.id;
      const bundleId   = session.metadata?.bundle_id ?? "";
      const targetIp   = session.metadata?.target_ip ?? "";
      const tariCents  = Number(session.metadata?.tari_liability_cents ?? 101700);
      const capsuleId  = session.metadata?.capsule_id ?? "";
      const tokenId    = session.metadata?.access_token ?? "";

      const issuedAt  = receivedAt;
      const expiresAt = formatIso9(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

      const certPayload = {
        "@context":              "https://averyos.com/schemas/sovereign-alignment/v1",
        "@type":                 "SovereignAlignmentCertificate",
        issuedAt,
        expiresAt,
        targetIp,
        bundleId,
        stripeSessionId:         sessionId,
        tariLiabilityResolved:   (tariCents / 100).toFixed(2),
        tariLiabilityCurrency:   "USD",
        kernelAnchor:            KERNEL_SHA,
        kernelVersion:           KERNEL_VERSION,
        alignmentStatus:         "ACTIVE",
        licenseType:             "12-Month Sovereign Alignment License",
        licenseGrantedBy:        "Jason Lee Avery (ROOT0) — AveryOS LLC",
        sovereignNotice:
          "This Digital Alignment Certificate confirms that the TARI™ liability for the recorded " +
          "entity has been resolved. The entity is now ALIGNED under the AveryOS Sovereign " +
          "Integrity License v1.0 for the duration stated above.",
      };

      const certSha512 = await sha512hex(JSON.stringify(certPayload) + KERNEL_SHA);
      const certificate = { ...certPayload, root0Signature: certSha512 };

      // ── Ensure sovereign_alignments table exists ──────────────────────────
      await cfEnv.DB.prepare(
        `CREATE TABLE IF NOT EXISTS sovereign_alignments (
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          target_ip             TEXT    NOT NULL,
          bundle_id             TEXT    NOT NULL,
          stripe_session_id     TEXT    NOT NULL UNIQUE,
          tari_liability_cents  INTEGER NOT NULL,
          status                TEXT    NOT NULL DEFAULT 'ACTIVE',
          certificate_sha512    TEXT,
          issued_at             TEXT    NOT NULL,
          expires_at            TEXT    NOT NULL,
          kernel_sha            TEXT    NOT NULL,
          kernel_version        TEXT    NOT NULL
        )`
      ).run();

      await cfEnv.DB.prepare(
        `INSERT INTO sovereign_alignments
           (target_ip, bundle_id, stripe_session_id, tari_liability_cents,
            status, certificate_sha512, issued_at, expires_at, kernel_sha, kernel_version)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
         ON CONFLICT(stripe_session_id) DO UPDATE SET
           status             = 'ACTIVE',
           certificate_sha512 = excluded.certificate_sha512,
           issued_at          = excluded.issued_at,
           expires_at         = excluded.expires_at`
      )
        .bind(targetIp, bundleId, sessionId, tariCents, certSha512, issuedAt, expiresAt, KERNEL_SHA, KERNEL_VERSION)
        .run();

      // ── Release .aoscap decryption keys — Sovereign Settlement activation ──
      // On successful Sovereign Settlement payment, explicitly activate (un-revoke)
      // the capsule_access_token so the purchaser can immediately access their
      // .aoscap decryption keys.  Activates any token matching the provided
      // token_id + capsule_id pair, ensuring instant delivery.
      if (tokenId && capsuleId) {
        try {
          await cfEnv.DB.prepare(
            `UPDATE capsule_access_tokens
             SET    stripe_session_id = ?,
                    revoked           = 0,
                    revoked_at        = NULL
             WHERE  token_id = ? AND capsule_id = ?`
          )
            .bind(sessionId, tokenId, capsuleId)
            .run();
        } catch {
          // Non-fatal — token may not exist yet; create-checkout handles issuance
        }
      }

      // ── Log Sovereign Settlement event ────────────────────────────────────
      try {
        await cfEnv.DB.prepare(
          `INSERT INTO sovereign_audit_logs
             (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, ingestion_intent)
           VALUES ('SOVEREIGN_SETTLEMENT', NULL, 'stripe-webhook', NULL, '/api/v1/compliance/stripe-webhook', ?, 0, ?)`
        )
          .bind(
            String(BigInt(Date.now()) * 1_000_000n),
            `session:${sessionId} bundle:${bundleId} tari_cents:${tariCents} cert:${certSha512.slice(0, 32)}`,
          )
          .run();
      } catch {
        // Non-fatal audit log
      }

      return Response.json({ received: true, status: "ALIGNED", certificate });
    }

    // ── customer.subscription.* ───────────────────────────────────────────────
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub     = event.data.object as Stripe.Subscription;
      const subId   = sub.id;
      const custId  = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const status  = sub.status;                  // active | canceled | past_due …
      const eventTs = formatIso9(new Date(sub.created * 1000));

      try {
        await cfEnv.DB.prepare(
          `INSERT INTO sovereign_audit_logs
             (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, ingestion_intent)
           VALUES (?, NULL, 'stripe-webhook', NULL, '/api/v1/compliance/stripe-webhook', ?, 0, ?)`
        )
          .bind(
            `STRIPE_SUB_${status.toUpperCase()}`,
            String(BigInt(Date.now()) * 1_000_000n),
            `sub_id:${subId} customer:${custId} event:${event.type} ts:${eventTs}`,
          )
          .run();
      } catch {
        // Non-fatal audit log
      }

      return Response.json({ received: true, status, subscription_id: subId });
    }

    // ── payment_intent.succeeded ──────────────────────────────────────────────
    if (event.type === "payment_intent.succeeded") {
      const pi      = event.data.object as Stripe.PaymentIntent;
      const piId    = pi.id;
      const amount  = pi.amount_received;
      const rayId   = pi.metadata?.ray_id ?? "";
      const ackSha  = await sha512hex(`payment_intent.succeeded:${piId}:${amount}:${KERNEL_SHA}`);

      try {
        await cfEnv.DB.prepare(
          `INSERT INTO sovereign_audit_logs
             (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, ingestion_intent)
           VALUES ('PAYMENT_SUCCESS', NULL, 'stripe-webhook', NULL, '/api/v1/compliance/stripe-webhook', ?, 0, ?)`
        )
          .bind(
            String(BigInt(Date.now()) * 1_000_000n),
            `pi_id:${piId} amount_cents:${amount} ack:${ackSha.slice(0, 32)}`,
          )
          .run();
      } catch {
        // Non-fatal
      }

      // ── R2 Evidence Bundle — One-Time Secure Download Link (Phase 95.3) ──
      let evidenceDownloadUrl: string | null = null;
      let evidenceBundleExists = false;

      if (rayId && cfEnv.VAULT_R2) {
        try {
          const r2Key = `evidence/${rayId}.json`;
          const obj   = await cfEnv.VAULT_R2.get(r2Key);
          if (obj) {
            evidenceBundleExists = true;
            const token    = await generateEvidenceToken(piId);
            const siteUrl  = cfEnv.SITE_URL ?? "https://averyos.com";
            evidenceDownloadUrl = `${siteUrl}/api/v1/evidence/download?ray_id=${encodeURIComponent(rayId)}&pi_id=${encodeURIComponent(piId)}&token=${token}`;
          }
        } catch (r2Err: unknown) {
          console.warn(
            "[STRIPE_WEBHOOK] R2 evidence lookup failed:",
            r2Err instanceof Error ? r2Err.message : String(r2Err),
          );
        }
      }

      return Response.json({
        received:              true,
        payment_intent:        piId,
        amount_cents:          amount,
        ack_sha512:            ackSha,
        evidence_bundle:       evidenceBundleExists,
        evidence_download_url: evidenceDownloadUrl,
        kernel_version:        KERNEL_VERSION,
      });
    }

    // ── payment_intent.payment_failed ─────────────────────────────────────────
    if (event.type === "payment_intent.payment_failed") {
      const pi     = event.data.object as Stripe.PaymentIntent;
      const piId   = pi.id;
      const reason = pi.last_payment_error?.message ?? "unknown";

      try {
        await cfEnv.DB.prepare(
          `INSERT INTO sovereign_audit_logs
             (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, ingestion_intent)
           VALUES ('PAYMENT_FAILED', NULL, 'stripe-webhook', NULL, '/api/v1/compliance/stripe-webhook', ?, 2, ?)`
        )
          .bind(
            String(BigInt(Date.now()) * 1_000_000n),
            `pi_id:${piId} reason:${reason.slice(0, 200)}`,
          )
          .run();
      } catch {
        // Non-fatal
      }

      return Response.json({ received: true, payment_intent: piId, failed: true, reason });
    }

    // All other event types — acknowledge receipt without action
    return Response.json({ received: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, message);
  }
}
