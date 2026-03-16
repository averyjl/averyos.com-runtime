/**
 * GET /api/v1/cron/reconcile
 *
 * Daily Stripe vs D1 Reconciliation Cron — Phase 93.5 / 94.5
 *
 * Runs daily at 00:00 MST (07:00 UTC) via Cloudflare Cron Trigger.
 * Also callable manually with a valid VAULT_PASSPHRASE Bearer token.
 *
 * Workflow:
 *   1. Fetch all Stripe checkout.session.completed events for the past 48 hours.
 *   2. For each completed session, check if a matching sovereign_alignments row exists.
 *   3. If the row is missing or INACTIVE, upsert it to ACTIVE (heals drift).
 *   4. Log a RECONCILIATION_COMPLETE event to sovereign_audit_logs.
 *   5. Return a summary of healed + already-aligned records.
 *
 * Wrangler secrets required:
 *   STRIPE_SECRET_KEY — Stripe secret key
 *   VAULT_PASSPHRASE  — Manual trigger authorisation token
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { reconcileClocks, type ComplianceClock } from "../../../../../lib/compliance/clockEngine";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
  STRIPE_SECRET_KEY?: string;
  VAULT_PASSPHRASE?:  string;
}

interface AlignmentRow {
  status: string;
}

/** Constant-time comparison to prevent timing-based token enumeration. */
/** Compute SHA-512 hex digest */
async function sha512hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Look-back window: 48 hours of Stripe events (covers a missed daily run) */
const LOOKBACK_SECONDS = 48 * 60 * 60;

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Authorisation ─────────────────────────────────────────────────────────
    // Accept either a Cloudflare Cron call (no auth header) or a Bearer token
    const authHeader   = request.headers.get("authorization") ?? "";
    const isCronCall   = !authHeader;
    const vaultPass    = cfEnv.VAULT_PASSPHRASE ?? "";
    const bearerToken  = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const isAuthorized = isCronCall || (!!vaultPass && safeEqual(bearerToken, vaultPass));

    if (!isAuthorized) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Bearer VAULT_PASSPHRASE token required.");
    }

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "D1 DB binding is not configured.");
    }

    const stripeKey = cfEnv.STRIPE_SECRET_KEY ?? "";
    if (!stripeKey) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, "STRIPE_SECRET_KEY is not configured.");
    }

    const stripe    = new Stripe(stripeKey);
    const startedAt = formatIso9(new Date());
    const cutoffTs  = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;
    const db        = cfEnv.DB;

    // ── Ensure sovereign_alignments table exists ──────────────────────────────
    await db.prepare(
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

    // ── Paginate Stripe checkout.session.completed events ────────────────────
    let healed   = 0;
    let verified = 0;
    let page: Stripe.ApiList<Stripe.Event> | null = null;

    do {
      const params: Stripe.EventListParams = {
        type:    "checkout.session.completed",
        created: { gte: cutoffTs },
        limit:   100,
      };
      if (page?.data.length && page.has_more) {
        params.starting_after = page.data[page.data.length - 1].id;
      }

      page = await stripe.events.list(params);

      for (const evt of page.data) {
        const session   = evt.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;
        const targetIp  = session.metadata?.target_ip ?? "";
        const bundleId  = session.metadata?.bundle_id ?? "";
        const tariCents = Number(session.metadata?.tari_liability_cents ?? 101700);

        // Check D1 for this session
        const row = await db
          .prepare("SELECT status FROM sovereign_alignments WHERE stripe_session_id = ?")
          .bind(sessionId)
          .first<AlignmentRow>();

        if (row?.status === "ACTIVE") {
          verified++;
          continue;
        }

        // Drift detected — heal it
        const issuedAt  = formatIso9(new Date());
        const expiresAt = formatIso9(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
        const certSha   = await sha512hex(`reconciled:${sessionId}:${KERNEL_SHA}`);

        await db
          .prepare(
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
          .bind(targetIp, bundleId, sessionId, tariCents, certSha, issuedAt, expiresAt, KERNEL_SHA, KERNEL_VERSION)
          .run();

        healed++;
      }
    } while (page.has_more);

    const completedAt  = formatIso9(new Date());
    const runSha       = await sha512hex(`reconcile:${startedAt}:healed=${healed}:verified=${verified}:${KERNEL_SHA}`);

    // ── Log reconciliation event ──────────────────────────────────────────────
    try {
      await db.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, ingestion_intent)
         VALUES ('RECONCILIATION_COMPLETE', NULL, 'cron/reconcile', NULL, '/api/v1/cron/reconcile', ?, 0, ?)`
      )
        .bind(
          String(BigInt(Date.now()) * 1_000_000n),
          `healed:${healed} verified:${verified} run_sha:${runSha.slice(0, 32)} completed:${completedAt}`,
        )
        .run();
    } catch {
      // Non-fatal audit log failure
    }

    // ── Reconcile compliance clocks (Roadmap Gate 2.2) ────────────────────────
    // Query ACTIVE compliance_clocks, evaluate deadlines, escalate expired ones.
    let clocksEscalated = 0;
    let clocksActive    = 0;
    try {
      const clockRows = await db
        .prepare(
          `SELECT clock_id, entity_id, asn, org_name, status, issued_at, deadline_at,
                  settled_at, debt_cents
             FROM compliance_clocks
            WHERE status = 'ACTIVE'
            LIMIT 200`
        )
        .all<{
          clock_id: string; entity_id: string | null; asn: string | null;
          org_name: string | null; status: string;
          issued_at: string; deadline_at: string;
          settled_at: string | null; debt_cents: number | null;
        }>();

      const rawClocks: ComplianceClock[] = (clockRows.results ?? []).map(r => ({
        clock_id:        r.clock_id,
        asn:             r.asn,
        org_name:        r.org_name,
        issued_at:       r.issued_at,
        deadline_at:     r.deadline_at,
        status:          r.status as "ACTIVE" | "EXPIRED" | "SETTLED",
        remainingMs:     Math.max(0, new Date(r.deadline_at).getTime() - Date.now()),
        remainingDisplay: "",
        expired:         Date.now() > new Date(r.deadline_at).getTime(),
        kernelSha:       KERNEL_SHA,
        kernelVersion:   KERNEL_VERSION,
      }));

      const { result: clockResult, clocks: updatedClocks } = reconcileClocks(rawClocks);
      clocksEscalated = clockResult.escalated;
      clocksActive    = clockResult.active;

      // Persist escalated clocks back to D1
      for (const uc of updatedClocks) {
        if (uc.status === "EXPIRED" && uc.expired) {
          db.prepare(
            `UPDATE compliance_clocks
                SET status = 'EXPIRED', escalated_at = ?
              WHERE clock_id = ? AND status = 'ACTIVE'`
          )
            .bind(new Date().toISOString(), uc.clock_id)
            .run()
            .catch((err: unknown) => {
              console.warn(`[reconcile] Clock escalation failed for ${uc.clock_id}:`,
                err instanceof Error ? err.message : String(err));
            });
        }
      }
    } catch {
      // Non-critical — compliance_clocks table may not exist yet
    }

    return Response.json({
      resonance:      "RECONCILIATION_COMPLETE",
      started_at:     startedAt,
      completed_at:   completedAt,
      lookback_hours: LOOKBACK_SECONDS / 3600,
      healed,
      verified,
      total_processed: healed + verified,
      run_sha512:     runSha,
      // Compliance clock reconciliation summary
      clocks_escalated: clocksEscalated,
      clocks_active:    clocksActive,
      kernel_version: KERNEL_VERSION,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, `Reconciliation failed: ${message}`);
  }
}
