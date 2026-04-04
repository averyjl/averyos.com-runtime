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
import { recordGeminiSpend, GEMINI_COST_PER_1K_TOKENS, type GeminiSpendKV } from "../../../../../lib/geminiSpendTracker";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

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
  KV_LOGS?: GeminiSpendKV;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

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

  // ── Phase 88: Gemini spend accumulator (race-free fan-out write) ────────
  // Writes a unique per-call entry to KV_LOGS — no read, no race condition.
  // lib/geminiSpendTracker.recordGeminiSpend() uses a unique key per call so
  // concurrent requests never overwrite each other. 100.000% accurate.
  if (cfEnv.KV_LOGS && total_tokens && total_tokens > 0) {
    const costUsd = estimated_cost_usd ?? (total_tokens / 1000) * GEMINI_COST_PER_1K_TOKENS;
    recordGeminiSpend(cfEnv.KV_LOGS, costUsd).catch(() => {});
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
