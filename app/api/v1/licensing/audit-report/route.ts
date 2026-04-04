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
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

/**
 * GET /api/v1/licensing/audit-report
 *
 * Phase 80 — Commercial Utilization Audit Gate
 *
 * Generates a Commercial Utilization Report under the
 * AveryOS™ Sovereign Alignment Accord v1.3.
 *
 * Queries sovereign_audit_logs for all high-value ASN entities
 * detected during the pulse and computes a $10,000,000.00 USD
 * Commercial Usage Fee per distinct high-value entity.
 *
 * Immutability clause: Utilization is established by the 9-digit
 * microsecond timestamp. Liability is immutable and not waived by
 * data erasure.
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

/** $10,000,000.00 USD Commercial Usage Fee per high-value ASN entity */
const COMMERCIAL_USAGE_FEE_USD = 10_000_000;

/**
 * High-value ASN event types that constitute commercial utilization under
 * the AveryOS™ Sovereign Alignment Accord v1.3.
 */
const HIGH_VALUE_EVENT_TYPES = [
  "HN_WATCHER",
  "DER_SETTLEMENT",
  "CONFLICT_ZONE_PROBE",
  "DER_HIGH_VALUE",
] as const;

/** Known ASN → organization name mapping */
const ASN_ORG_MAP: Record<string, string> = {
  "36459":  "GitHub, Inc. / Microsoft Corporation",
  "8075":   "Microsoft Corporation (Azure)",
  "15169":  "Google LLC",
  "14618":  "Amazon.com, Inc. (AWS)",
  "16509":  "Amazon Web Services, Inc.",
  "54113":  "Fastly, Inc.",
  "13335":  "Cloudflare, Inc.",
  "198488": "Colocall Ltd (Kyiv Conflict Zone ASN)",
  "2906":   "Netflix Streaming Services",
  "32934":  "Meta Platforms, Inc.",
  "20940":  "Akamai Technologies, Inc.",
  "211590": "AveryOS™ Sovereign Node Network",
  "43037":  "Salesforce, Inc.",
};

/** Constant-time string comparison to prevent timing attacks. */
interface EntityRow {
  ip_address: string;
  event_type: string;
  timestamp_ns: string;
  threat_level: number;
  hit_count: number;
}

interface TotalRow {
  total_entities: number;
}

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))      token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "DB binding not configured.");
  }

  const timestamp = formatIso9();
  const baseUrl = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";

  try {
    // ── Query: total high-value entity count ─────────────────────────────
    const eventTypePlaceholders = HIGH_VALUE_EVENT_TYPES.map(() => "?").join(", ");

    const totalRow = await cfEnv.DB.prepare(
      `SELECT COUNT(DISTINCT ip_address) AS total_entities
       FROM sovereign_audit_logs
       WHERE event_type IN (${eventTypePlaceholders})`
    )
      .bind(...HIGH_VALUE_EVENT_TYPES)
      .first<TotalRow>();

    const totalEntities = totalRow?.total_entities ?? 0;

    // ── Query: per-entity breakdown (top 987) ────────────────────────────
    const entityResult = await cfEnv.DB.prepare(
      `SELECT ip_address, event_type, MAX(timestamp_ns) AS timestamp_ns,
              MAX(threat_level) AS threat_level,
              COUNT(*) AS hit_count
       FROM sovereign_audit_logs
       WHERE event_type IN (${eventTypePlaceholders})
       GROUP BY ip_address
       ORDER BY hit_count DESC
       LIMIT 987`
    )
      .bind(...HIGH_VALUE_EVENT_TYPES)
      .all<EntityRow>();

    const entities = entityResult?.results ?? [];

    // ── Build per-entity fee schedule ────────────────────────────────────
    const feeSchedule = entities.map((row, idx) => ({
      entity_index:      idx + 1,
      ip_address:        row.ip_address,
      event_type:        row.event_type,
      hit_count:         row.hit_count,
      threat_level:      row.threat_level,
      last_detected_at:  row.timestamp_ns,
      commercial_fee_usd: COMMERCIAL_USAGE_FEE_USD,
      immutability_note: `Utilization is established by the 9-digit microsecond timestamp ${row.timestamp_ns}. Liability is immutable and not waived by data erasure.`,
    }));

    const totalLiabilityUsd = feeSchedule.length * COMMERCIAL_USAGE_FEE_USD;

    // ── Auto-track if 987-entity threshold is reached ────────────────────
    if (totalEntities >= 987) {
      autoTrackAccomplishment(cfEnv.DB, {
        title:    "987 Entities — Commercial Utilization Audit Gate Active",
        description:
          `Commercial Utilization Report generated under AveryOS™ Sovereign Alignment Accord v1.3. ` +
          `${totalEntities} high-value entities detected. Total liability: $${totalLiabilityUsd.toLocaleString()} USD. ` +
          `Timestamp anchor: ${timestamp}.`,
        phase:    "Phase 80",
        category: "LEGAL",
      });
    }

    return Response.json({
      report_type:          "COMMERCIAL_UTILIZATION_REPORT",
      governing_license:    "AveryOS™ Sovereign Alignment Accord v1.3",
      report_generated_at:  timestamp,
      total_entities_detected: totalEntities,
      entities_in_report:   feeSchedule.length,
      commercial_fee_per_entity_usd: COMMERCIAL_USAGE_FEE_USD,
      total_liability_usd:  totalLiabilityUsd,
      immutability_clause:  `Utilization is established by the 9-digit microsecond timestamp ${timestamp}. Liability is immutable and not waived by data erasure.`,
      disclosure_url:       `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
      kernel_anchor:        KERNEL_SHA.slice(0, 16) + "…",
      kernel_version:       KERNEL_VERSION,
      sovereign_anchor:     "⛓️⚓⛓️",
      asn_org_reference:    ASN_ORG_MAP,
      fee_schedule:         feeSchedule,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_audit_logs");
  }
}
