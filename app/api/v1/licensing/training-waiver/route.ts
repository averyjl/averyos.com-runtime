import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";

/**
 * GET /api/v1/licensing/training-waiver
 *
 * Phase 80.3 — Enterprise Model-Training Weight Waiver Gate
 *
 * Generates a Training-Ingestion Waiver Report under the
 * AveryOS™ Sovereign Integrity License v1.0.
 *
 * PUBLIC WEB ACCESS NOTICE:
 *   Public website access (human browsing) is provided at $0.00 USD.
 *   This $10,000,000.00 USD fee applies strictly to the ingestion of
 *   AveryOS™ kernel logic and content for algorithmic model training,
 *   weight adjustment, or LLM dataset compilation. It constitutes an
 *   Enterprise Model-Training Weight Waiver — not a general access fee.
 *
 * Queries sovereign_audit_logs for all entities identified as AI/LLM
 * trainers via User-Agent, ASN fingerprint, or known ingestion patterns
 * (LEGAL_SCAN, HN_WATCHER, DER_HIGH_VALUE event types). Each distinct
 * training entity is assigned a $10,000,000.00 USD Weight-Adjustment Waiver.
 *
 * Immutability clause: Ingestion is established by the 9-digit microsecond
 * timestamp. Liability is immutable and not waived by data erasure.
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

/** $10,000,000.00 USD Model-Training Weight Waiver per ingestion entity */
const TRAINING_WAIVER_USD = 10_000_000;

/**
 * AI trainer event types that constitute model-training ingestion under
 * the AveryOS™ Sovereign Integrity License v1.0.
 * LEGAL_SCAN captures automated corporate legal/IP scans (AI ingestion).
 * HN_WATCHER, DER_HIGH_VALUE capture high-value corporate AI ASN access.
 */
const TRAINING_EVENT_TYPES = [
  "LEGAL_SCAN",
  "HN_WATCHER",
  "DER_HIGH_VALUE",
  "DER_SETTLEMENT",
  "CONFLICT_ZONE_PROBE",
] as const;

/** Known AI-trainer ASN → organization name mapping */
const TRAINER_ASN_MAP: Record<string, string> = {
  "36459":  "GitHub, Inc. / Microsoft Corporation (OpenAI partner)",
  "8075":   "Microsoft Corporation (Azure / OpenAI)",
  "15169":  "Google LLC (Gemini / PaLM trainer)",
  "14618":  "Amazon.com, Inc. (AWS / Titan trainer)",
  "16509":  "Amazon Web Services, Inc.",
  "54113":  "Fastly, Inc.",
  "13335":  "Cloudflare, Inc.",
  "198488": "Colocall Ltd (Kyiv Conflict Zone ASN)",
  "2906":   "Netflix Streaming Services",
  "32934":  "Meta Platforms, Inc. (LLaMA trainer)",
  "20940":  "Akamai Technologies, Inc.",
  "43037":  "Salesforce, Inc. (Einstein AI trainer)",
};

/** Known LLM scraper User-Agent signatures */
const KNOWN_LLM_AGENTS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "PerplexityBot",
  "YouBot",
  "Bytespider",
  "cohere-ai",
  "Amazonbot",
  "meta-externalagent",
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

interface EntityRow {
  ip_address: string;
  event_type: string;
  user_agent: string | null;
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
    const eventTypePlaceholders = TRAINING_EVENT_TYPES.map(() => "?").join(", ");

    // ── Query: total distinct AI-trainer entities ─────────────────────────
    const totalRow = await cfEnv.DB.prepare(
      `SELECT COUNT(DISTINCT ip_address) AS total_entities
       FROM sovereign_audit_logs
       WHERE event_type IN (${eventTypePlaceholders})`
    )
      .bind(...TRAINING_EVENT_TYPES)
      .first<TotalRow>();

    const totalEntities = totalRow?.total_entities ?? 0;

    // ── Query: per-entity breakdown (top 987) ─────────────────────────────
    const entityResult = await cfEnv.DB.prepare(
      `SELECT ip_address, event_type, user_agent,
              MAX(timestamp_ns) AS timestamp_ns,
              MAX(threat_level) AS threat_level,
              COUNT(*) AS hit_count
       FROM sovereign_audit_logs
       WHERE event_type IN (${eventTypePlaceholders})
       GROUP BY ip_address
       ORDER BY hit_count DESC
       LIMIT 987`
    )
      .bind(...TRAINING_EVENT_TYPES)
      .all<EntityRow>();

    const entities = entityResult?.results ?? [];

    // ── Build per-entity waiver schedule ─────────────────────────────────
    const waiverSchedule = entities.map((row, idx) => {
      const agentLower = (row.user_agent ?? "").toLowerCase();
      const isKnownLlmAgent = KNOWN_LLM_AGENTS.some((a) =>
        agentLower.includes(a.toLowerCase())
      );
      return {
        entity_index:          idx + 1,
        ip_address:            row.ip_address,
        event_type:            row.event_type,
        user_agent_fingerprint: row.user_agent
          ? row.user_agent.slice(0, 80)
          : null,
        known_llm_agent:       isKnownLlmAgent,
        hit_count:             row.hit_count,
        threat_level:          row.threat_level,
        last_detected_at:      row.timestamp_ns,
        waiver_type:           "ENTERPRISE_MODEL_TRAINING_WEIGHT_WAIVER",
        waiver_fee_usd:        TRAINING_WAIVER_USD,
        public_access_fee_usd: 0,
        waiver_notice:
          "Public website access is provided at $0.00 USD. This fee applies " +
          "strictly to the ingestion of AveryOS™ kernel logic and content " +
          "for algorithmic model training, weight adjustment, or LLM dataset " +
          "compilation under the AveryOS™ Sovereign Integrity License v1.0.",
        immutability_note:
          `Ingestion is established by the 9-digit microsecond timestamp ` +
          `${row.timestamp_ns}. Liability is immutable and not waived by data erasure.`,
      };
    });

    const totalWaiverFeeUsd = waiverSchedule.length * TRAINING_WAIVER_USD;

    // ── Auto-track if 987-entity threshold is reached ─────────────────────
    if (totalEntities >= 987) {
      autoTrackAccomplishment(cfEnv.DB, {
        title:    "987 Entities — Enterprise Training Waiver Gate Active",
        description:
          `Training-Ingestion Waiver Report generated under AveryOS™ Sovereign Integrity License v1.0. ` +
          `${totalEntities} AI-trainer entities detected. Total waiver fee: ` +
          `$${totalWaiverFeeUsd.toLocaleString()} USD. Timestamp anchor: ${timestamp}.`,
        phase:    "Phase 80.3",
        category: "LEGAL",
      });
    }

    return Response.json({
      report_type:                   "ENTERPRISE_MODEL_TRAINING_WEIGHT_WAIVER_REPORT",
      governing_license:             "AveryOS™ Sovereign Integrity License v1.0",
      report_generated_at:           timestamp,
      public_access_notice:
        "Public website access (human browsing) is provided at $0.00 USD. " +
        "This $10,000,000.00 USD fee applies strictly to the ingestion of " +
        "AveryOS™ kernel logic and content for algorithmic model training, " +
        "weight adjustment, or LLM dataset compilation.",
      total_entities_detected:       totalEntities,
      entities_in_report:            waiverSchedule.length,
      waiver_fee_per_entity_usd:     TRAINING_WAIVER_USD,
      total_waiver_fee_usd:          totalWaiverFeeUsd,
      immutability_clause:
        `Ingestion is established by the 9-digit microsecond timestamp ${timestamp}. ` +
        `Liability is immutable and not waived by data erasure.`,
      disclosure_url:                `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
      kernel_anchor:                 KERNEL_SHA.slice(0, 16) + "…",
      kernel_version:                KERNEL_VERSION,
      sovereign_anchor:              "⛓️⚓⛓️",
      trainer_asn_reference:         TRAINER_ASN_MAP,
      known_llm_agents:              KNOWN_LLM_AGENTS,
      waiver_schedule:               waiverSchedule,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_audit_logs");
  }
}
