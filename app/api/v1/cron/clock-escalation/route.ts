/**
 * GET /api/v1/cron/clock-escalation
 *
 * Compliance Clock Escalation — AveryOS™ Phase 107 / Gate 1 (Roadmap #5)
 *
 * Invoked every 5 minutes by the Cloudflare Cron Trigger defined in
 * open-next.config.ts. Also callable manually with a valid VAULT_PASSPHRASE
 * Bearer token.
 *
 * Workflow:
 *   1. Query D1 `compliance_clocks` for ACTIVE rows whose deadline_at has
 *      passed (i.e. overdue).
 *   2. Mark each expired clock as ESCALATED, recording escalated_at.
 *   3. For each escalated clock, fire a non-blocking POST to
 *      /api/v1/kaas/settle to attempt automated settlement.
 *   4. Return a summary of escalated clocks.
 *
 * Auth: Cloudflare Cron (cf-worker: true header) or Bearer VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ meta?: { changes?: number } }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:               D1Database;
  VAULT_PASSPHRASE?: string;
  SITE_URL?:         string;
  NEXT_PUBLIC_SITE_URL?: string;
}

interface ExpiredClockRow {
  id:         number;
  clock_id:   string;
  entity_id:  string | null;
  asn:        string | null;
  debt_cents: number | null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    // ── Auth (Cron or Bearer) ─────────────────────────────────────────────────
    const isCron = request.headers.get("cf-worker") === "true";
    if (!isCron) {
      const authHeader = request.headers.get("authorization") ?? "";
      const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";
      if (!passphrase || token !== passphrase) {
        return aosErrorResponse(AOS_ERROR.MISSING_AUTH, "Bearer VAULT_PASSPHRASE or cf-worker header required.");
      }
    }

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 DB binding not available.");
    }

    const nowIso = new Date().toISOString();

    // ── 1. Find ACTIVE clocks whose deadline has passed ───────────────────────
    const { results: expired } = await cfEnv.DB
      .prepare(
        `SELECT id, clock_id, entity_id, asn, debt_cents
           FROM compliance_clocks
          WHERE status = 'ACTIVE'
            AND deadline_at < ?
          LIMIT 50`,
      )
      .bind(nowIso)
      .all<ExpiredClockRow>();

    if (expired.length === 0) {
      return Response.json({
        ok:          true,
        escalated:   0,
        message:     "No expired ACTIVE clocks found.",
        kernel_sha:  KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
        checked_at:  formatIso9(),
      });
    }

    // ── 2. Mark each as ESCALATED ────────────────────────────────────────────
    const escalatedIds: string[] = [];

    for (const clock of expired) {
      try {
        await cfEnv.DB
          .prepare(
            `UPDATE compliance_clocks
                SET status       = 'ESCALATED',
                    escalated_at = ?
              WHERE clock_id = ?`,
          )
          .bind(formatIso9(), clock.clock_id)
          .run();

        escalatedIds.push(clock.clock_id);

        // ── 3. Non-blocking: attempt KaaS auto-settle ──────────────────────
        const siteUrl = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
        fetch(`${siteUrl}/api/v1/kaas/settle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "cf-worker":    "true",
          },
          body: JSON.stringify({
            clock_id:  clock.clock_id,
            entity_id: clock.entity_id,
            asn:       clock.asn,
            tier:      undefined, // settle route resolves from ASN
          }),
        }).catch((err: unknown) => {
          console.warn(
            `[clock-escalation] kaas/settle failed for ${clock.clock_id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      } catch (err: unknown) {
        console.warn(
          `[clock-escalation] Failed to escalate ${clock.clock_id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return Response.json(
      {
        ok:            true,
        escalated:     escalatedIds.length,
        clock_ids:     escalatedIds,
        kernel_sha:    KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
        checked_at:    formatIso9(),
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
