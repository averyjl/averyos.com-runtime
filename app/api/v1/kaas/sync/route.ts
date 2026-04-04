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
 * GET /api/v1/kaas/sync
 *
 * KaaS Ledger Sync API — AveryOS™ Phase 106 / Roadmap Gate 2 (Third Roadmap)
 *
 * Queries the kaas_ledger D1 table and syncs all OPEN/PENDING entries to
 * Firebase Firestore via syncKaasValuationToFirebase() for cross-cloud audit
 * parity.  Surfaces the SHA-512 evidence fingerprint of each row to the
 * Admin Settlement Dashboard in real-time.
 *
 * Actions:
 *   GET ?action=sync   — sync kaas_ledger rows to Firebase (default)
 *   GET ?action=status — return sync status without writing to Firebase
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }        from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION }  from "../../../../../lib/sovereignConstants";
import { formatIso9 }                  from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { syncKaasValuationToFirebase, isFirebaseConfigured }
  from "../../../../../lib/firebaseClient";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

// ── Local types ───────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...v: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

interface LedgerRow {
  id:           number;
  entity_name:  string;
  asn:          string | null;
  org_name:     string | null;
  ray_id:       string | null;
  amount_owed:  number;
  settlement_status: string;
  kernel_sha:   string;
  created_at:   string;
}

/** Constant-time comparison to prevent timing-based token enumeration. */
/** SHA-512 hex digest for evidence fingerprinting. */
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const now     = formatIso9();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const vaultPass = cfEnv.VAULT_PASSPHRASE ?? "";
  if (vaultPass) {
    const authHeader  = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!safeEqual(bearerToken, vaultPass)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        "Valid Bearer VAULT_PASSPHRASE token required.");
    }
  }

  // ── Parse action ──────────────────────────────────────────────────────────
  const url    = new URL(request.url);
  const action = url.searchParams.get("action") ?? "sync";
  const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

  // ── Query kaas_ledger ─────────────────────────────────────────────────────
  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding (DB) is not configured.");
  }

  let rows: LedgerRow[] = [];
  try {
    const result = await cfEnv.DB
      .prepare(
        `SELECT id, entity_name, asn, org_name, ray_id, amount_owed, settlement_status,
                kernel_sha, created_at
           FROM kaas_ledger
          WHERE settlement_status IN ('OPEN', 'PENDING')
          ORDER BY created_at DESC
          LIMIT ?`
      )
      .bind(limit)
      .all<LedgerRow>();
    rows = result.results ?? [];
  } catch (err: unknown) {
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED,
      `kaas_ledger query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Build evidence fingerprints ───────────────────────────────────────────
  const rowsWithFingerprints = await Promise.all(
    rows.map(async (row) => {
      const fingerprint = await sha512hex(
        `${row.id}|${row.entity_name}|${row.asn ?? ""}|${row.amount_owed}|${row.created_at}|${KERNEL_SHA}`
      );
      return { ...row, evidence_sha512: fingerprint };
    })
  );

  // ── Sync to Firebase (if action=sync and Firebase is configured) ──────────
  const syncResults: { id: number; status: string }[] = [];

  if (action === "sync" && isFirebaseConfigured()) {
    for (const row of rows) {
      try {
        await syncKaasValuationToFirebase({
          asn:            row.asn ?? "",
          ip_address:     "UNKNOWN",
          tier:           1,
          valuation_usd:  row.amount_owed,
          status:         row.settlement_status,
          ray_id:         row.ray_id ?? null,
          pulse_hash:     null,
          kernel_version: KERNEL_VERSION,
          created_at:     row.created_at,
        });
        syncResults.push({ id: row.id, status: "SYNCED" });
      } catch (err: unknown) {
        syncResults.push({
          id:     row.id,
          status: `FAILED: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // ── Response ──────────────────────────────────────────────────────────────
  return Response.json(
    {
      resonance:          "HIGH_FIDELITY_SUCCESS",
      action,
      queried_at:         now,
      total_open_rows:    rows.length,
      firebase_configured: isFirebaseConfigured(),
      sync_results:       action === "sync" ? syncResults : [],

      // Ledger rows with evidence fingerprints
      ledger:             rowsWithFingerprints,

      // Kernel anchor
      kernel_sha:         KERNEL_SHA.slice(0, 32) + "…",
      kernel_version:     KERNEL_VERSION,
      sovereign_anchor:   "⛓️⚓⛓️",
    },
    { status: 200 },
  );
}
