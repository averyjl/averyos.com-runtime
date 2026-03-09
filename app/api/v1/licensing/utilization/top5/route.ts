import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../../lib/taiAutoTracker";

/**
 * GET /api/v1/licensing/utilization/top5
 *
 * Phase 80.6 — Enterprise Resource Metering — Top 5 ASN Aggregation
 *
 * Queries anchor_audit_logs to identify the top 5 autonomous systems (ASNs)
 * by request volume and assigns a $10,000,000.00 USD Replacement Cost Basis
 * per entity representing the computational value of the AveryOS™ cf83™ Kernel
 * logic accessed during the March 9, 2026 forensic surge.
 *
 * Source data: 25,836 anchor_audit_logs captured in the March 9 surge.
 *
 * PUBLIC WEB ACCESS NOTICE:
 *   Public website access (human browsing) is provided at $0.00 USD.
 *   This valuation applies strictly to automated deep-probe ingestion of
 *   AveryOS™ kernel logic for commercial, AI-training, or infrastructure
 *   analysis purposes under the AveryOS™ Sovereign Integrity License v1.0.
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

/** $10,000,000.00 USD Replacement Cost Basis per ASN entity */
const REPLACEMENT_COST_BASIS_USD = 10_000_000;

/** Known ASN → organization name mapping */
const ASN_ORG_MAP: Record<string, string> = {
  "36459": "GitHub, Inc. / Microsoft Corporation",
  "8075":  "Microsoft Corporation (Azure)",
  "15169": "Google LLC",
  "16509": "Amazon Web Services, Inc.",
  "14618": "Amazon.com, Inc.",
};

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

interface AsnRow {
  asn: string;
  hit_count: number;
  first_contact: string;
  last_contact: string;
}

interface TotalRow {
  total_logs: number;
}

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))        token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "DB binding not configured.");
  }

  const timestamp = formatIso9();
  const baseUrl   = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";

  try {
    // ── Query: total anchor_audit_logs count ──────────────────────────────
    const totalRow = await cfEnv.DB.prepare(
      `SELECT COUNT(*) AS total_logs FROM anchor_audit_logs`
    ).first<TotalRow>();

    const totalLogs = totalRow?.total_logs ?? 0;

    // ── Query: top-5 ASNs by hit count ────────────────────────────────────
    const asnResult = await cfEnv.DB.prepare(
      `SELECT asn,
              COUNT(*)     AS hit_count,
              MIN(anchored_at) AS first_contact,
              MAX(anchored_at) AS last_contact
       FROM anchor_audit_logs
       WHERE asn IS NOT NULL AND asn != '' AND asn != 'UNKNOWN'
       GROUP BY asn
       ORDER BY hit_count DESC
       LIMIT 5`
    ).all<AsnRow>();

    const asnRows = asnResult?.results ?? [];

    // ── Build per-ASN valuation schedule ─────────────────────────────────
    const valuationSchedule = asnRows.map((row, idx) => ({
      rank:                        idx + 1,
      asn:                         row.asn,
      organization:                ASN_ORG_MAP[row.asn] ?? `ASN ${row.asn}`,
      hit_count:                   row.hit_count,
      first_contact:               row.first_contact,
      last_contact:                row.last_contact,
      valuation_type:              "ENTERPRISE_RESOURCE_METERING",
      metadata_label:              "Enterprise Resource Metering — Top 5 Aggregation",
      replacement_cost_basis_usd:  REPLACEMENT_COST_BASIS_USD,
      valuation_note:
        "Replacement Cost Basis reflects the total computational resource " +
        "value of the AveryOS™ cf83™ Kernel logic consumed by this entity. " +
        "Public web access is $0.00 USD. This valuation applies to automated " +
        "deep-probe ingestion for commercial or AI-training purposes only.",
      immutability_note:
        `Commercial utilization is established by the 9-digit microsecond ` +
        `timestamp anchor. Valuation is immutable and not waived by data erasure.`,
    }));

    const totalValuationUsd = valuationSchedule.length * REPLACEMENT_COST_BASIS_USD;

    // ── Auto-track once top-5 data is populated ───────────────────────────
    if (asnRows.length > 0) {
      autoTrackAccomplishment(cfEnv.DB, {
        title:    "Top-5 Global IP Valuation Hardlocked — Enterprise Resource Metering Active",
        description:
          `Top-5 ASN Commercial Utilization Audit generated. ` +
          `${totalLogs} total anchor_audit_logs across ${asnRows.length} ASNs. ` +
          `Total Replacement Cost Basis: $${totalValuationUsd.toLocaleString()} USD. ` +
          `Timestamp anchor: ${timestamp}.`,
        phase:    "Phase 80.6",
        category: "FORENSIC",
      });
    }

    return Response.json({
      report_type:                          "ENTERPRISE_RESOURCE_METERING_TOP5",
      metadata_label:                       "Enterprise Resource Metering — Top 5 Aggregation",
      governing_license:                    "AveryOS™ Sovereign Integrity License v1.0",
      report_generated_at:                  timestamp,
      source_data:                          `${totalLogs} anchor_audit_logs (March 9, 2026 forensic surge)`,
      total_asns_in_report:                 valuationSchedule.length,
      replacement_cost_basis_per_asn_usd:   REPLACEMENT_COST_BASIS_USD,
      total_replacement_cost_usd:           totalValuationUsd,
      public_access_fee_usd:                0,
      public_access_note:
        "Public website access (human browsing) is provided at $0.00 USD. " +
        "The replacement cost basis applies solely to automated ingestion, " +
        "deep-probe activity, and commercial use of the AveryOS™ cf83™ Kernel.",
      immutability_clause:
        `Commercial utilization is established by the 9-digit microsecond timestamp ${timestamp}. ` +
        `Valuation is immutable and not waived by data erasure.`,
      disclosure_url:                       `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
      kernel_anchor:                        KERNEL_SHA.slice(0, 16) + "…",
      kernel_version:                       KERNEL_VERSION,
      sovereign_anchor:                     "⛓️⚓⛓️",
      top5_valuation_schedule:              valuationSchedule,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "anchor_audit_logs");
  }
}
