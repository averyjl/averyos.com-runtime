/**
 * POST /api/v1/tari/ai-utilization
 *
 * Phase 91 — AveryOS™ TARI™ AI Invoicing
 *
 * Records AI inference token usage per ASN and computes a
 * $1,000.00 USD AI Inference Surcharge for any entity that triggers
 * a cloud-AI (Gemini) lookup.  This surcharge is added to the
 * $10,000,000.00 baseline commercial replacement cost.
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE.
 *
 * Request body:
 *   {
 *     "asn":          string   — originating ASN
 *     "model":        string   — Gemini model ID used
 *     "total_tokens": number   — total tokens consumed
 *     "prompt_tokens":  number
 *     "completion_tokens": number
 *     "estimated_cost_usd": number — raw Gemini API cost
 *     "threat_level": number   — forensic threat level (1–10)
 *     "path":         string?  — request path
 *     "ray_id":       string?  — Cloudflare RayID
 *   }
 *
 * Response:
 *   {
 *     "surcharge_usd":      number   ($1,000.00 per cloud-AI invocation)
 *     "tari_reference":     string
 *     "asn":                string
 *     "total_tokens":       number
 *     "estimated_cost_usd": number
 *     "kernel_sha":         string
 *     "recorded_at":        string
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

// ── Fee constants ─────────────────────────────────────────────────────────────
/** Per-invocation AI Inference Surcharge (on top of the $10M baseline). */
const AI_INFERENCE_SURCHARGE_USD = 1_000.00;

// ── Interfaces ────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:               D1Database;
  VAULT_PASSPHRASE?: string;
  KV_LOGS?: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  let cfEnv: CloudflareEnv;
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "Cloudflare binding unavailable", 503);
  }

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Invalid or missing auth token", 401);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    asn?:                 string;
    model?:               string;
    total_tokens?:        number;
    prompt_tokens?:       number;
    completion_tokens?:   number;
    estimated_cost_usd?:  number;
    threat_level?:        number;
    path?:                string;
    ray_id?:              string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body is not valid JSON", 400);
  }

  const {
    asn,
    model,
    total_tokens,
    prompt_tokens,
    completion_tokens,
    estimated_cost_usd,
    threat_level,
    path,
    ray_id,
  } = body;

  if (!asn || typeof asn !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "asn (originating ASN) is required", 400);
  }

  const recordedAt    = formatIso9();
  const timestampNs   = Date.now().toString() + "000000";
  const tariReference = `TARI-AI-${asn}-${Date.now()}`;

  // ── Log to D1 ─────────────────────────────────────────────────────────────
  if (cfEnv.DB) {
    cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path,
          timestamp_ns, threat_level, tari_liability_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "AI_INFERENCE_SURCHARGE",
        asn,
        model ?? "gemini",
        asn,
        path ?? "/api/v1/tari/ai-utilization",
        timestampNs,
        threat_level ?? 8,
        AI_INFERENCE_SURCHARGE_USD,
      )
      .run()
      .catch(() => {});
  }

  // ── Phase 88: Gemini spend accumulator ──────────────────────────────────
  // Accumulate the estimated Gemini cost for the Phase 88 circuit breaker.
  if (cfEnv.KV_LOGS && total_tokens && total_tokens > 0) {
    const now = new Date();
    const spendKey = `gemini_monthly_spend_${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    cfEnv.KV_LOGS.get(spendKey).then(async (current) => {
      const prev = parseFloat(current ?? '0') || 0;
      const cost = estimated_cost_usd ?? (total_tokens / 1000) * 0.00125;
      await cfEnv.KV_LOGS!.put(spendKey, (prev + cost).toFixed(6));
    }).catch(() => {});
  }

  return Response.json({
    surcharge_usd:      AI_INFERENCE_SURCHARGE_USD,
    tari_reference:     tariReference,
    asn,
    model:              model ?? null,
    total_tokens:       total_tokens ?? 0,
    prompt_tokens:      prompt_tokens ?? 0,
    completion_tokens:  completion_tokens ?? 0,
    estimated_cost_usd: estimated_cost_usd ?? 0,
    threat_level:       threat_level ?? null,
    path:               path ?? null,
    ray_id:             ray_id ?? null,
    kernel_sha:         KERNEL_SHA,
    kernel_version:     KERNEL_VERSION,
    recorded_at:        recordedAt,
  });
}
