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
 * GET /api/v1/valuation/latest
 *
 * AveryOS™ IVI Valuation Endpoint — Phase 118 GATE 118.7.4
 *
 * Returns the latest Independent Valuation Impact (IVI) computation for
 * the AveryOS™ sovereign ecosystem.
 *
 * Query parameters:
 *   flawless=true                      — Apply Flawless-Operation multiplier (×1.17)
 *   unblocked=true                     — Apply Unblocked Assistance multiplier (×2.5)
 *   efficiency=true                    — Apply Efficiency Premium multiplier (×3.0)
 *   apply_corporate_latency_premium=true — Apply Corporate Latency Premium (×1.2)
 *   bot_count=<number>                 — Override the unaligned bot count (default: read from D1)
 *
 * This endpoint reads the current TARI™ bot count from D1 and computes
 * a fresh IVI record on each request. Results are NOT persisted (ephemeral
 * computation).  Auth is optional — the endpoint is public-readable.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { computeIvi }           from "../../../../../lib/forensics/valuationAudit";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 }           from "../../../../../lib/timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CloudflareEnv {
  DB?: D1Database;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

interface BotCountRow {
  total_bots: number;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // ── Parse query parameters ────────────────────────────────────────────────
  const applyFlawless    = url.searchParams.get("flawless")                     === "true";
  const applyUnblocked   = url.searchParams.get("unblocked")                    === "true";
  const applyEfficiency  = url.searchParams.get("efficiency")                   === "true";
  const applyCorpLatency = url.searchParams.get("apply_corporate_latency_premium") === "true";
  const botCountOverride = url.searchParams.get("bot_count");

  let unblockedBotCount = 0;

  // ── Resolve bot count ─────────────────────────────────────────────────────
  if (botCountOverride !== null) {
    const parsed = parseInt(botCountOverride, 10);
    unblockedBotCount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  } else {
    // Attempt to read live bot count from D1
    try {
      const { env } = await getCloudflareContext({ async: true });
      const cfEnv   = env as unknown as CloudflareEnv;

      if (cfEnv.DB) {
        const row = await cfEnv.DB
          .prepare(
            "SELECT COUNT(DISTINCT ip_address) AS total_bots " +
            "FROM sovereign_audit_logs " +
            "WHERE event_type = 'UNALIGNED_401'"
          )
          .first<BotCountRow>();
        unblockedBotCount = row?.total_bots ?? 0;
      }
    } catch {
      // Non-fatal — fall back to 0
      unblockedBotCount = 0;
    }
  }

  // ── Compute IVI ───────────────────────────────────────────────────────────
  try {
    const record = await computeIvi({
      unaligned_bot_count:           unblockedBotCount,
      apply_flawless_multiplier:     applyFlawless,
      apply_unblocked_assistance:    applyUnblocked,
      apply_efficiency_premium:      applyEfficiency,
      apply_corporate_latency_premium: applyCorpLatency,
      notes:
        [
          applyFlawless    && "flawless_operation",
          applyUnblocked   && "unblocked_assistance",
          applyEfficiency  && "efficiency_premium",
          applyCorpLatency && "corporate_latency_premium",
        ]
          .filter(Boolean)
          .join(", ") || undefined,
    });

    return new Response(
      JSON.stringify({
        ok:             true,
        record,
        computed_at:    formatIso9(new Date()),
        kernel_version: KERNEL_VERSION,
        kernel_sha:     KERNEL_SHA,
      }),
      {
        status:  200,
        headers: {
          "Content-Type":                "application/json",
          "Cache-Control":               "no-store",
          "X-AveryOS-Kernel":            KERNEL_VERSION,
          "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
        },
      },
    );
  } catch (err) {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      err instanceof Error ? err.message : "IVI computation failed.",
      500,
    );
  }
}
