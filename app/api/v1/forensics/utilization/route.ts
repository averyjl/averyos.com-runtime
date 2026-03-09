import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";

/**
 * GET /api/v1/forensics/utilization
 *
 * Phase 80.3 — Computational Resource Utilization Valuation
 *
 * Technical IP Asset Valuation endpoint.
 *
 * Queries sovereign_audit_logs for all detected entities across all event
 * types and assigns a $10,000,000.00 USD Replacement Cost Basis representing
 * the computational cost of the AveryOS™ cf83 Kernel logic accessed.
 *
 * This endpoint is labeled "Technical IP Asset Valuation" for internal IP
 * asset management and auditing. The Replacement Cost Basis reflects the
 * total computational resource value consumed by each unique entity.
 *
 * Immutability clause: Computational utilization is established by the 9-digit
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

/** $10,000,000.00 USD Replacement Cost Basis of the cf83™ Kernel per access entity */
const REPLACEMENT_COST_BASIS_USD = 10_000_000;

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
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

interface EntityRow {
  ip_address: string;
  event_type: string;
  timestamp_ns: string;
  threat_level: number | null;
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
    // ── Query: total distinct entities (all event types) ─────────────────
    const totalRow = await cfEnv.DB.prepare(
      `SELECT COUNT(DISTINCT ip_address) AS total_entities
       FROM sovereign_audit_logs`
    ).first<TotalRow>();

    const totalEntities = totalRow?.total_entities ?? 0;

    // ── Query: per-entity breakdown (top 987, ordered by hit count) ───────
    const entityResult = await cfEnv.DB.prepare(
      `SELECT ip_address, event_type, MAX(timestamp_ns) AS timestamp_ns,
              MAX(threat_level) AS threat_level,
              COUNT(*) AS hit_count
       FROM sovereign_audit_logs
       GROUP BY ip_address
       ORDER BY hit_count DESC
       LIMIT 987`
    ).all<EntityRow>();

    const entities = entityResult?.results ?? [];

    // ── Build per-entity computational cost valuation schedule ────────────
    const utilizationSchedule = entities.map((row, idx) => ({
      entity_index:             idx + 1,
      ip_address:               row.ip_address,
      dominant_event_type:      row.event_type,
      hit_count:                row.hit_count,
      threat_level:             row.threat_level ?? 1,
      last_detected_at:         row.timestamp_ns,
      valuation_type:           "COMPUTATIONAL_RESOURCE_VALUE",
      metadata_label:           "Technical IP Asset Valuation",
      replacement_cost_basis_usd: REPLACEMENT_COST_BASIS_USD,
      valuation_note:
        "Replacement Cost Basis reflects the total computational resource " +
        "value of the AveryOS™ cf83™ Kernel logic consumed by this entity. " +
        "This is Technical IP Asset Valuation for internal auditing purposes.",
      immutability_note:
        `Computational utilization is established by the 9-digit microsecond ` +
        `timestamp ${row.timestamp_ns}. Valuation is immutable and not waived by data erasure.`,
    }));

    const totalReplacementCostUsd = utilizationSchedule.length * REPLACEMENT_COST_BASIS_USD;

    // ── Auto-track if 987-entity threshold is reached ─────────────────────
    if (totalEntities >= 987) {
      autoTrackAccomplishment(cfEnv.DB, {
        title:    "987 Entities — Computational Resource Utilization Valuation Active",
        description:
          `Computational Resource Utilization Report generated. ` +
          `${totalEntities} distinct entities detected across all event types. ` +
          `Total Replacement Cost Basis: $${totalReplacementCostUsd.toLocaleString()} USD. ` +
          `Timestamp anchor: ${timestamp}.`,
        phase:    "Phase 80.3",
        category: "FORENSIC",
      });
    }

    return Response.json({
      report_type:                     "COMPUTATIONAL_RESOURCE_UTILIZATION_REPORT",
      metadata_label:                  "Technical IP Asset Valuation",
      governing_license:               "AveryOS™ Sovereign Integrity License v1.0",
      report_generated_at:             timestamp,
      total_entities_detected:         totalEntities,
      entities_in_report:              utilizationSchedule.length,
      replacement_cost_basis_per_entity_usd: REPLACEMENT_COST_BASIS_USD,
      total_replacement_cost_usd:      totalReplacementCostUsd,
      immutability_clause:
        `Computational utilization is established by the 9-digit microsecond timestamp ${timestamp}. ` +
        `Valuation is immutable and not waived by data erasure.`,
      disclosure_url:                  `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
      kernel_anchor:                   KERNEL_SHA.slice(0, 16) + "…",
      kernel_version:                  KERNEL_VERSION,
      sovereign_anchor:                "⛓️⚓⛓️",
      asn_org_reference:               ASN_ORG_MAP,
      utilization_schedule:            utilizationSchedule,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_audit_logs");
  }
}
