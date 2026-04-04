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
 * GET /api/v1/cron/clock-escalation
 *
 * Compliance Clock Escalation Cron — AveryOS™ Phase 107.1 (Gate 1 Sovereign Roadmap)
 *
 * Wires clockEngine.ts expiry detection to automatic KaaS settlement triggers.
 *
 * Workflow:
 *   1. Scan compliance_clocks for rows that are ACTIVE but have passed their
 *      deadline_at timestamp → mark them ESCALATED.
 *   2. For each newly ESCALATED clock, fire a non-blocking POST to
 *      /api/v1/kaas/settle with an auto-settle payload.
 *   3. Log the escalation event to sovereign_audit_logs.
 *   4. Return a summary of escalated + already-settled records.
 *
 * Triggered by Cloudflare Cron every 5 minutes (shares the every-5-min cron trigger).
 * Also callable manually with a valid VAULT_PASSPHRASE Bearer token.
 *
 * Wrangler secrets required:
 *   VAULT_PASSPHRASE — Manual trigger authorisation token
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { syncD1RowToFirebase } from "../../../../../lib/firebaseClient";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

// ── Local type interfaces (no @cloudflare/workers-types import) ───────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:                D1Database;
  VAULT_PASSPHRASE?:  string;
  SITE_URL?:          string;
  NEXT_PUBLIC_SITE_URL?: string;
}

interface ComplianceClockRow {
  id:           number;
  clock_id:     string;
  asn:          string;
  org_name:     string | null;
  issued_at:    string;
  deadline_at:  string;
  status:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Non-blocking POST to /api/v1/kaas/settle to auto-trigger KaaS settlement
 * for an ESCALATED compliance clock.
 */
function autoTriggerKaasSettle(
  baseUrl: string,
  vaultPassphrase: string,
  clock: ComplianceClockRow,
): void {
  const payload = {
    asn:         clock.asn,
    clock_id:    clock.clock_id,
    org_name:    clock.org_name ?? "UNKNOWN",
    issued_at:   clock.issued_at,
    deadline_at: clock.deadline_at,
    reason:      "CLOCK_ESCALATION_AUTO_SETTLE",
    kernel_sha:  KERNEL_SHA,
  };

  fetch(`${baseUrl}/api/v1/kaas/settle`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${vaultPassphrase}`,
      "X-AveryOS-Cron": "clock-escalation",
    },
    body: JSON.stringify(payload),
  }).catch((err: unknown) => {
    console.warn(
      `[clock-escalation] KaaS settle trigger failed for ${clock.clock_id}:`,
      err instanceof Error ? err.message : String(err),
    );
  });
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    const baseUrl = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";

    // ── Authorisation ──────────────────────────────────────────────────────────
    // Cloudflare Cron calls set cf-worker: true (per existing cron pattern).
    // Manual callers must provide a Bearer VAULT_PASSPHRASE token.
    const authHeader = request.headers.get("authorization") ?? "";
    const isCronCall = request.headers.get("cf-worker") === "true";
    const vaultPass  = cfEnv.VAULT_PASSPHRASE ?? "";
    const bearer     = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const isAuth     = isCronCall || (!!vaultPass && safeEqual(bearer, vaultPass));

    if (!isAuth) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Bearer VAULT_PASSPHRASE token required.");
    }

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "D1 DB binding is not configured.");
    }

    const db        = cfEnv.DB;
    const now       = formatIso9();
    const nowIso    = new Date().toISOString();
    let escalated   = 0;
    let alreadyDone = 0;

    // ── Ensure table exists ────────────────────────────────────────────────────
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS compliance_clocks (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        clock_id       TEXT    NOT NULL UNIQUE,
        asn            TEXT    NOT NULL DEFAULT 'UNKNOWN',
        org_name       TEXT,
        issued_at      TEXT    NOT NULL,
        deadline_at    TEXT    NOT NULL,
        status         TEXT    NOT NULL DEFAULT 'ACTIVE',
        firebase_synced INTEGER NOT NULL DEFAULT 0,
        kernel_sha     TEXT    NOT NULL,
        kernel_version TEXT    NOT NULL,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      )`
    ).run();

    // ── Fetch ACTIVE clocks that have passed their deadline ───────────────────
    const { results: expiredClocks } = await db.prepare(
      `SELECT id, clock_id, asn, org_name, issued_at, deadline_at, status
       FROM compliance_clocks
       WHERE status = 'ACTIVE' AND deadline_at <= ?
       LIMIT 100`
    )
      .bind(nowIso)
      .all<ComplianceClockRow>();

    // ── Fetch already ESCALATED clocks for count reporting ────────────────────
    const { results: escalatedClocks } = await db.prepare(
      `SELECT id, clock_id, asn, org_name, issued_at, deadline_at, status
       FROM compliance_clocks
       WHERE status = 'ESCALATED'
       LIMIT 200`
    )
      .bind()
      .all<ComplianceClockRow>();

    alreadyDone = escalatedClocks.length;

    // ── Escalate expired clocks ───────────────────────────────────────────────
    for (const clock of expiredClocks) {
      // Mark ESCALATED in D1
      await db.prepare(
        `UPDATE compliance_clocks SET status = 'ESCALATED' WHERE clock_id = ?`
      )
        .bind(clock.clock_id)
        .run();

      // Auto-trigger POST /api/v1/kaas/settle (non-blocking)
      if (vaultPass) {
        autoTriggerKaasSettle(baseUrl, vaultPass, clock);
      }

      // Mirror escalation to Firebase (Gate 2 — non-blocking)
      syncD1RowToFirebase({
        id:           clock.clock_id,
        event_type:   "COMPLIANCE_CLOCK_ESCALATED",
        ip_address:   clock.asn,
        target_path:  "/api/v1/cron/clock-escalation",
        threat_level: 9,
        timestamp_ns: now,
      }).catch(() => {});

      escalated++;
    }

    // ── Log run ────────────────────────────────────────────────────────────────
    const runSha = await sha512hex(
      `clock-escalation:escalated=${escalated}:ts=${now}:${KERNEL_SHA}`,
    );

    try {
      await db.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level, ingestion_intent)
         VALUES ('CLOCK_ESCALATION_COMPLETE', NULL, 'cron/clock-escalation', NULL, '/api/v1/cron/clock-escalation', ?, 0, ?)`
      )
        .bind(
          String(BigInt(Date.now()) * 1_000_000n),
          `escalated:${escalated} already_escalated:${alreadyDone} run_sha:${runSha.slice(0, 32)}`,
        )
        .run();
    } catch {
      // Non-fatal audit log failure
    }

    return Response.json({
      resonance:        "CLOCK_ESCALATION_COMPLETE",
      run_at:           now,
      escalated,
      already_escalated: alreadyDone,
      total_processed:  escalated + alreadyDone,
      run_sha512:       runSha,
      kernel_version:   KERNEL_VERSION,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, `Clock escalation failed: ${msg}`);
  }
}
