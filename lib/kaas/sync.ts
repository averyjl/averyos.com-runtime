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
 * lib/kaas/sync.ts
 *
 * KaaS Ledger Sync — AveryOS™ Phase 105.1 GATE 105.1.4
 *
 * Mirrors KaaS valuations from D1 (kaas_valuations table) to the Admin UI
 * with SHA-512 evidence seals.  Each row is wrapped in a KaasLedgerEntry
 * that includes a computed SHA-512 digest of the row data for
 * tamper-evident display in the Admin Settlement Dashboard.
 *
 * Used by:
 *   • app/admin/settlements/page.tsx
 *   • app/admin/monetization/page.tsx
 *   • app/api/v1/kaas/sync/route.ts (new endpoint)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── D1 row shape ───────────────────────────────────────────────────────────────

export interface KaasValuationRow {
  id:                number;
  ip_address:        string | null;
  asn:               string | null;
  tier:              number | null;
  valuation_usd:     string | number | null;
  fee_name:          string | null;
  settlement_status: string | null;
  pulse_hash:        string | null;
  created_at:        string | null;
  path:              string | null;
}

// ── Enriched ledger entry ──────────────────────────────────────────────────────

export interface KaasLedgerEntry extends KaasValuationRow {
  /** SHA-512 evidence seal computed from the row fields. */
  evidenceSha:    string;
  /** Human-readable valuation display string. */
  valuationDisplay: string;
  /** ISO-8601 timestamp of when this entry was sealed. */
  sealedAt:       string;
  /** Kernel anchor for this entry. */
  kernelVersion:  string;
}

// ── Sync status ────────────────────────────────────────────────────────────────

export interface KaasLedgerSyncResult {
  entries:          KaasLedgerEntry[];
  totalRows:        number;
  pendingCount:     number;
  settledCount:     number;
  totalAssessedUsd: number;
  totalAssessedDisplay: string;
  syncedAt:         string;
  kernelVersion:    string;
  kernelSha:        string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatUsd(val: string | number | null): string {
  if (val === null || val === undefined) return "$0.00";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ── Core sync function ─────────────────────────────────────────────────────────

/**
 * Seal a raw D1 row into a {@link KaasLedgerEntry} with a SHA-512 evidence
 * digest.
 *
 * @param row  Raw row from kaas_valuations D1 table
 */
export async function sealKaasRow(row: KaasValuationRow): Promise<KaasLedgerEntry> {
  const sealedAt = new Date().toISOString();
  const payload  = JSON.stringify({
    id:                row.id,
    ip_address:        row.ip_address,
    asn:               row.asn,
    tier:              row.tier,
    valuation_usd:     row.valuation_usd,
    settlement_status: row.settlement_status,
    pulse_hash:        row.pulse_hash,
    created_at:        row.created_at,
    kernelSha:         KERNEL_SHA,
    sealedAt,
  });
  const evidenceSha = await sha512hex(payload);
  return {
    ...row,
    evidenceSha,
    valuationDisplay: formatUsd(row.valuation_usd),
    sealedAt,
    kernelVersion: KERNEL_VERSION,
  };
}

/**
 * Sync an array of raw D1 rows into sealed {@link KaasLedgerEntry} objects
 * and compute aggregate totals.
 *
 * @param rows  Array of raw kaas_valuations rows
 */
export async function syncKaasLedger(
  rows: KaasValuationRow[],
): Promise<KaasLedgerSyncResult> {
  const entries: KaasLedgerEntry[] = await Promise.all(rows.map(sealKaasRow));

  let totalAssessedUsd = 0;
  let pendingCount     = 0;
  let settledCount     = 0;

  for (const entry of entries) {
    const val = typeof entry.valuation_usd === "string"
      ? parseFloat(entry.valuation_usd)
      : (entry.valuation_usd ?? 0);
    if (!isNaN(val)) totalAssessedUsd += val;

    if (entry.settlement_status === "SETTLED" || entry.settlement_status === "PAID") {
      settledCount++;
    } else {
      pendingCount++;
    }
  }

  const syncedAt = new Date().toISOString();
  return {
    entries,
    totalRows:            entries.length,
    pendingCount,
    settledCount,
    totalAssessedUsd,
    totalAssessedDisplay: formatUsd(totalAssessedUsd),
    syncedAt,
    kernelVersion:        KERNEL_VERSION,
    kernelSha:            KERNEL_SHA,
  };
}
