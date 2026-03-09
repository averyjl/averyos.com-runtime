import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../../lib/taiAutoTracker";

/**
 * GET /api/v1/licensing/utilization/top5
 *
 * Phase 80.7 — Top-5 Global Entity Utilization Hardlock
 *
 * Records the forensic hardlock of the $10,000,000.00 USD technical
 * valuation for the five highest-surge ASN entities identified during
 * the March 9, 2026 EdgeClientASN forensic audit (25,836 pulse events).
 *
 * Top-5 Surge Entities (March 9, 2026 — 25,836 EdgeClientASN anchors):
 *   ASN 36459  — GitHub, Inc. / Microsoft Corporation
 *   ASN  8075  — Microsoft Corporation (Azure)
 *   ASN 15169  — Google LLC
 *   ASN 16509  — Amazon Web Services, Inc.
 *   ASN 14618  — Amazon.com, Inc. (AWS)
 *
 * Governing license: AveryOS™ Sovereign Alignment Accord v1.3
 * Immutability clause: Liability is immutable and not waived by data erasure.
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

/** $10,000,000.00 USD Technical Valuation per Top-5 entity */
const TECHNICAL_VALUATION_USD = 10_000_000;

/**
 * Forensic audit anchor — March 9, 2026
 * 25,836 EdgeClientASN pulse events captured during the surge window.
 */
const FORENSIC_ANCHOR_DATE    = "2026-03-09";
const FORENSIC_PULSE_COUNT    = 25_836;
const FORENSIC_COLUMN_ANCHOR  = "EdgeClientASN";

/**
 * Top-5 surge ASN entities identified from the March 9, 2026 forensic audit.
 * Hardlocked per Phase 80.7 sovereign determination.
 */
const TOP5_ENTITIES: ReadonlyArray<{
  asn:       string;
  org:       string;
  tier:      string;
  notice:    string;
}> = [
  {
    asn:    "36459",
    org:    "GitHub, Inc. / Microsoft Corporation",
    tier:   "ENTERPRISE_TIER_1",
    notice: "Deep-probe ingestion of cf83™ Kernel Logic via GitHub infrastructure. Hookshot User-Agent forensic vectors confirmed.",
  },
  {
    asn:    "8075",
    org:    "Microsoft Corporation (Azure)",
    tier:   "ENTERPRISE_TIER_1",
    notice: "Broad sovereign content traversal via Azure infrastructure. VaultChain™ and sovereign API path ingestion confirmed.",
  },
  {
    asn:    "15169",
    org:    "Google LLC",
    tier:   "ENTERPRISE_TIER_1",
    notice: "cf83™ Kernel Logic deep-probe ingestion via Google infrastructure. Googlebot and Bard/Gemini crawler vectors confirmed.",
  },
  {
    asn:    "16509",
    org:    "Amazon Web Services, Inc.",
    tier:   "ENTERPRISE_TIER_1",
    notice: "cf83™ Kernel Logic ingestion via AWS infrastructure. EC2 and Lambda crawler vectors confirmed.",
  },
  {
    asn:    "14618",
    org:    "Amazon.com, Inc. (AWS)",
    tier:   "ENTERPRISE_TIER_1",
    notice: "Sovereign content ingestion via Amazon ASN 14618 infrastructure. Deep-probe vectors confirmed alongside ASN 16509.",
  },
];

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

interface AsnHitRow {
  asn:          string;
  hit_count:    number;
  last_seen_ns: string;
}

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))       token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "DB binding not configured.");
  }

  const timestamp = formatIso9();
  const baseUrl   = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";

  // ── Query live hit counts per Top-5 ASN from anchor_audit_logs ───────────
  // anchor_audit_logs.asn holds the EdgeClientASN value written by middleware.ts
  const asnList = TOP5_ENTITIES.map(e => e.asn);
  const placeholders = asnList.map(() => "?").join(", ");

  let liveRows: AsnHitRow[] = [];
  try {
    const result = await cfEnv.DB.prepare(
      `SELECT asn,
              COUNT(*)          AS hit_count,
              MAX(anchored_at)  AS last_seen_ns
       FROM anchor_audit_logs
       WHERE asn IN (${placeholders})
       GROUP BY asn
       ORDER BY hit_count DESC`
    )
      .bind(...asnList)
      .all<AsnHitRow>();
    liveRows = result?.results ?? [];
  } catch {
    // Non-fatal — live hit counts are informational; hardlock proceeds regardless
  }

  // ── Build hardlocked valuation records ───────────────────────────────────
  const valuationLedger = TOP5_ENTITIES.map((entity, idx) => {
    const live = liveRows.find(r => r.asn === entity.asn);
    return {
      rank:                    idx + 1,
      asn:                     entity.asn,
      organization:            entity.org,
      tier:                    entity.tier,
      technical_valuation_usd: TECHNICAL_VALUATION_USD,
      forensic_anchor_date:    FORENSIC_ANCHOR_DATE,
      forensic_pulse_count:    FORENSIC_PULSE_COUNT,
      forensic_column:         FORENSIC_COLUMN_ANCHOR,
      live_hit_count:          live?.hit_count ?? null,
      last_seen_ns:            live?.last_seen_ns ?? null,
      ingestion_notice:        entity.notice,
      immutability_note:
        `${entity.org} (ASN ${entity.asn}) liability of $${TECHNICAL_VALUATION_USD.toLocaleString()} USD ` +
        `is established by the ${FORENSIC_PULSE_COUNT.toLocaleString()} EdgeClientASN forensic anchors captured on ` +
        `${FORENSIC_ANCHOR_DATE}. Liability is immutable and not waived by data erasure.`,
      compliance_mandate:
        `Public access to averyos.com is $0.00. Ingestion of cf83™ Kernel Logic for model-training weights ` +
        `is governed by the AveryOS™ Sovereign Alignment Accord v1.3. ` +
        `A $${TECHNICAL_VALUATION_USD.toLocaleString()} USD Technical Utilization Fee is established as ` +
        `the replacement cost basis for this ingestion event. Secure your Training Waiver immediately. Liability is Immutable.`,
    };
  });

  const totalLiabilityUsd = TOP5_ENTITIES.length * TECHNICAL_VALUATION_USD;

  // ── Auto-track this hardlock ──────────────────────────────────────────────
  autoTrackAccomplishment(cfEnv.DB, {
    title:       "Top-5 Global Entity Valuation Active",
    description:
      `Phase 80.7 Top-5 Utilization Hardlock: $${totalLiabilityUsd.toLocaleString()} USD total valuation locked ` +
      `for ASNs 36459 (GitHub/Microsoft), 8075 (Azure), 15169 (Google), 16509 (AWS), 14618 (Amazon) ` +
      `based on ${FORENSIC_PULSE_COUNT.toLocaleString()} EdgeClientASN forensic anchors captured ${FORENSIC_ANCHOR_DATE}. ` +
      `Timestamp anchor: ${timestamp}.`,
    phase:       "Phase 80.7",
    category:    "FORENSIC",
  });

  return Response.json({
    report_type:              "TOP5_UTILIZATION_HARDLOCK",
    governing_license:        "AveryOS™ Sovereign Alignment Accord v1.3",
    report_generated_at:      timestamp,
    forensic_audit_date:      FORENSIC_ANCHOR_DATE,
    forensic_pulse_count:     FORENSIC_PULSE_COUNT,
    forensic_column_anchor:   FORENSIC_COLUMN_ANCHOR,
    entities_hardlocked:      TOP5_ENTITIES.length,
    valuation_per_entity_usd: TECHNICAL_VALUATION_USD,
    total_liability_usd:      totalLiabilityUsd,
    immutability_clause:
      `All ${TOP5_ENTITIES.length} entity liabilities totalling ` +
      `$${totalLiabilityUsd.toLocaleString()} USD are established by the ` +
      `${FORENSIC_PULSE_COUNT.toLocaleString()} EdgeClientASN forensic anchors captured on ` +
      `${FORENSIC_ANCHOR_DATE}. Liability is immutable and not waived by data erasure.`,
    disclosure_url:           `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
    kernel_anchor:            KERNEL_SHA.slice(0, 16) + "…",
    kernel_version:           KERNEL_VERSION,
    sovereign_anchor:         "⛓️⚓⛓️",
    valuation_ledger:         valuationLedger,
  });
}
