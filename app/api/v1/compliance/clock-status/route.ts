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
 * GET /api/v1/compliance/clock-status
 *
 * Settlement Clock Status — AveryOS™ Phase 106 / Roadmap Gate 1.8
 *
 * Exposes the current status of a 72-hour settlement clock for a given
 * entity. Used by the Admin Settlement Dashboard and external compliance
 * integrations to display real-time deadline countdown.
 *
 * Query parameters:
 *   entity_id  — required: ASN, clock_id, or org identifier
 *   settled    — optional: "true" to mark the clock as SETTLED before querying
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }                    from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION }              from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR }             from "../../../../../lib/sovereignError";
import { getSettlementDeadline, reconcileClocks,
         createComplianceClock, SETTLEMENT_WINDOW_HOURS }
  from "../../../../../lib/compliance/clockEngine";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

// ── Local types ───────────────────────────────────────────────────────────────

interface D1FirstResult {
  first<T = unknown>(): Promise<T | null>;
  bind(...v: unknown[]): D1FirstResult;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(sql: string): D1FirstResult;
}

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

interface ClockRow {
  clock_id:    string;
  entity_id:   string | null;
  asn:         string | null;
  org_name:    string | null;
  status:      string;
  issued_at:   string;
  deadline_at: string;
  settled_at:  string | null;
  debt_cents:  number | null;
}

/** Constant-time comparison to prevent timing-based token enumeration. */
// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const vaultPass = cfEnv.VAULT_PASSPHRASE ?? "";
  if (vaultPass) {
    const authHeader  = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!safeEqual(bearerToken, vaultPass)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        "Valid Bearer token required to access clock-status.");
    }
  }

  // ── Parse query params ────────────────────────────────────────────────────
  const url       = new URL(request.url);
  const entityId  = url.searchParams.get("entity_id")?.trim() ?? "";
  const settledQs = url.searchParams.get("settled") === "true";

  if (!entityId) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD,
      "entity_id query parameter is required (ASN, clock_id, or org identifier).");
  }

  // ── Query D1 for persisted clock ──────────────────────────────────────────
  let clockRow: ClockRow | null = null;

  if (cfEnv.DB) {
    try {
      clockRow = await cfEnv.DB
        .prepare(
          `SELECT clock_id, entity_id, asn, org_name, status, issued_at, deadline_at,
                  settled_at, debt_cents
             FROM compliance_clocks
            WHERE entity_id = ? OR asn = ? OR clock_id = ?
            ORDER BY created_at DESC
            LIMIT 1`
        )
        .bind(entityId, entityId, entityId)
        .first<ClockRow>();
    } catch {
      // Non-critical — fall through to synthetic clock
    }
  }

  // ── Evaluate clock ────────────────────────────────────────────────────────
  let clockData: ReturnType<typeof getSettlementDeadline>;
  let clockId    = "";
  let orgName    = "";
  let debtCents: number | null = null;
  let source     = "SYNTHETIC";

  if (clockRow) {
    const settled  = settledQs || clockRow.status === "SETTLED";
    clockData      = getSettlementDeadline(clockRow.issued_at, settled);
    clockId        = clockRow.clock_id;
    orgName        = clockRow.org_name ?? "";
    debtCents      = clockRow.debt_cents ?? null;
    source         = "D1_RECORD";

    // If caller says SETTLED but row is not yet SETTLED → update D1
    if (settledQs && clockRow.status !== "SETTLED" && cfEnv.DB) {
      cfEnv.DB.prepare(
        `UPDATE compliance_clocks SET status = 'SETTLED', settled_at = ? WHERE clock_id = ?`
      )
        .bind(new Date().toISOString(), clockRow.clock_id)
        .first()
        .then(() => { /* no-op — fire-and-forget settle update */ })
        .catch((err: unknown) => {
          console.warn("[clock-status] D1 settle update failed:", err instanceof Error ? err.message : String(err));
        });
    }
  } else {
    // No persisted clock — return a synthetic clock anchored to "now"
    const synthetic = await createComplianceClock(entityId, null, `clock_synthetic_${entityId}`);
    clockData       = getSettlementDeadline(synthetic.issued_at, settledQs);
    clockId         = synthetic.clock_id;
    source          = "SYNTHETIC";
  }

  // ── Reconcile (single-item) ───────────────────────────────────────────────
  const { result: reconResult } = reconcileClocks([{
    clock_id:        clockId,
    asn:             clockRow?.asn ?? entityId,
    org_name:        orgName || null,
    issued_at:       clockData.attestationTs,
    deadline_at:     clockData.deadlineTs,
    status:          clockData.status,
    remainingMs:     clockData.remainingMs,
    remainingDisplay: clockData.remainingDisplay,
    expired:         clockData.expired,
    kernelSha:       KERNEL_SHA,
    kernelVersion:   KERNEL_VERSION,
  }]);

  return Response.json(
    {
      resonance:          "HIGH_FIDELITY_SUCCESS",
      entity_id:          entityId,
      clock_id:           clockId,
      org_name:           orgName || null,
      source,

      // Clock state
      status:             clockData.status,
      issued_at:          clockData.attestationTs,
      deadline_at:        clockData.deadlineTs,
      remaining_ms:       clockData.remainingMs,
      remaining_display:  clockData.remainingDisplay,
      expired:            clockData.expired,
      window_hours:       SETTLEMENT_WINDOW_HOURS,

      // Debt snapshot
      debt_cents:         debtCents,

      // Reconciliation
      reconcile_summary:  reconResult,

      // Kernel anchor
      kernel_sha:         KERNEL_SHA.slice(0, 32) + "…",
      kernel_version:     KERNEL_VERSION,
      sovereign_anchor:   "⛓️⚓⛓️",
      queried_at:         new Date().toISOString(),
    },
    { status: 200 },
  );
}
