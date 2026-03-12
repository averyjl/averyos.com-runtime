import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

/**
 * GET /api/v1/forensics/resource-value
 *
 * Phase 80.3 — Technical IP Asset Valuation Gate
 *
 * Internal Resource Metering Metadata endpoint.
 *
 * Queries sovereign_audit_logs for all detected entities and assigns a
 * $10,000,000.00 USD Notional Asset Value representing the Replacement
 * Cost Basis of the AveryOS™ cf83 Kernel logic accessed.
 *
 * This endpoint is labeled "Internal Resource Metering Metadata" for
 * IP Asset management and internal auditing purposes. The Notional Asset
 * Value is not a charge to the visitor; it is the internal valuation of
 * the technical IP resource consumed per access event.
 *
 * Immutability clause: Resource utilization is established by the 9-digit
 * microsecond timestamp. Valuation is immutable and not waived by data erasure.
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

/** $10,000,000.00 USD Notional Asset Value — Replacement Cost Basis of the cf83™ Kernel */
const NOTIONAL_ASSET_VALUE_USD = 10_000_000;

/**
 * High-value event types included in the resource valuation.
 * These represent entities that consumed significant AveryOS™ technical IP.
 */
const RESOURCE_EVENT_TYPES = [
  "HN_WATCHER",
  "DER_SETTLEMENT",
  "CONFLICT_ZONE_PROBE",
  "DER_HIGH_VALUE",
  "LEGAL_SCAN",
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
    const eventTypePlaceholders = RESOURCE_EVENT_TYPES.map(() => "?").join(", ");

    // ── Query: total distinct entities ───────────────────────────────────
    const totalRow = await cfEnv.DB.prepare(
      `SELECT COUNT(DISTINCT ip_address) AS total_entities
       FROM sovereign_audit_logs
       WHERE event_type IN (${eventTypePlaceholders})`
    )
      .bind(...RESOURCE_EVENT_TYPES)
      .first<TotalRow>();

    const totalEntities = totalRow?.total_entities ?? 0;

    // ── Query: per-entity breakdown (top 987) ─────────────────────────────
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
      .bind(...RESOURCE_EVENT_TYPES)
      .all<EntityRow>();

    const entities = entityResult?.results ?? [];

    // ── Build per-entity notional asset valuation schedule ────────────────
    const valuationSchedule = entities.map((row, idx) => ({
      entity_index:         idx + 1,
      ip_address:           row.ip_address,
      event_type:           row.event_type,
      hit_count:            row.hit_count,
      threat_level:         row.threat_level,
      last_detected_at:     row.timestamp_ns,
      valuation_type:       "NOTIONAL_ASSET_VALUE",
      metadata_label:       "Internal Resource Metering Metadata",
      notional_value_usd:   NOTIONAL_ASSET_VALUE_USD,
      replacement_cost_basis_note:
        "Notional Asset Value represents the Replacement Cost Basis of the " +
        "AveryOS™ cf83™ Kernel logic accessed during this event. " +
        "This is internal IP asset management metadata — not a direct charge.",
      immutability_note:
        `Resource utilization is established by the 9-digit microsecond ` +
        `timestamp ${row.timestamp_ns}. Valuation is immutable and not waived by data erasure.`,
    }));

    const totalNotionalValueUsd = valuationSchedule.length * NOTIONAL_ASSET_VALUE_USD;

    // ── Auto-track if 987-entity threshold is reached ─────────────────────
    if (totalEntities >= 987) {
      autoTrackAccomplishment(cfEnv.DB, {
        title:    "987 Entities — Enterprise Resource Metering Live",
        description:
          `Technical Asset Valuation Report generated. ` +
          `${totalEntities} entities detected. Total Notional Asset Value: ` +
          `$${totalNotionalValueUsd.toLocaleString()} USD. Timestamp anchor: ${timestamp}.`,
        phase:    "Phase 80.3",
        category: "FORENSIC",
      });
    }

    return Response.json({
      report_type:                   "TECHNICAL_IP_ASSET_VALUATION_REPORT",
      metadata_label:                "Internal Resource Metering Metadata",
      governing_license:             "AveryOS™ Sovereign Integrity License v1.0",
      report_generated_at:           timestamp,
      total_entities_detected:       totalEntities,
      entities_in_report:            valuationSchedule.length,
      notional_asset_value_per_entity_usd: NOTIONAL_ASSET_VALUE_USD,
      total_notional_value_usd:      totalNotionalValueUsd,
      immutability_clause:
        `Resource utilization is established by the 9-digit microsecond timestamp ${timestamp}. ` +
        `Valuation is immutable and not waived by data erasure.`,
      disclosure_url:                `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
      kernel_anchor:                 KERNEL_SHA.slice(0, 16) + "…",
      kernel_version:                KERNEL_VERSION,
      sovereign_anchor:              "⛓️⚓⛓️",
      asn_org_reference:             ASN_ORG_MAP,
      valuation_schedule:            valuationSchedule,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_audit_logs");
  }
}
