/**
 * POST /api/v1/forensics/ai-stamp
 *
 * Phase 89 — AveryOS™ Forensic AI Stamping
 *
 * Accepts a Gemini AI analysis result and wraps it in a cf83™ VaultSignature.
 * The signature anchors the AI output to the current BTC block hash + the
 * sovereign kernel anchor before writing the stamped artifact to R2.
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE.
 *
 * Request body:
 *   {
 *     "gemini_text":  string   — raw Gemini output text
 *     "prompt_hash":  string   — SHA-512 hex of the original prompt
 *     "threat_level": number   — forensic threat level (1–10)
 *     "asn":          string?  — originating ASN
 *     "path":         string?  — target path of the original request
 *     "ray_id":       string?  — Cloudflare RayID of the probing request
 *     "total_tokens": number?  — Gemini token count
 *     "model":        string?  — Gemini model used
 *   }
 *
 * Response:
 *   {
 *     "vault_signature": string  — SHA-512 of (kernel_sha | btc_block | gemini_text)
 *     "r2_key":          string  — R2 object key for the stamped artifact
 *     "btc_block_hash":  string  — most recent BTC block hash used as anchor salt
 *     "kernel_sha":      string
 *     "stamped_at":      string  — ISO-9 timestamp
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { syncD1RowToFirebase } from "../../../../../lib/firebaseClient";

// ── Cloudflare env interfaces ─────────────────────────────────────────────────

interface R2Bucket {
  put(key: string, value: string): Promise<void>;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_R2?:        R2Bucket;
  VAULT_PASSPHRASE?: string;
  BLOCKCHAIN_API_KEY?: string;
  KV_LOGS?: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/** SHA-512 of an arbitrary string via Web Crypto. */
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fetch the latest BTC block hash from BlockCypher.
 * Falls back to KERNEL_SHA on network failure.
 */
async function fetchBtcBlockHash(apiKey?: string): Promise<string> {
  try {
    const url = apiKey
      ? `https://api.blockcypher.com/v1/btc/main?token=${apiKey}`
      : `https://api.blockcypher.com/v1/btc/main`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return KERNEL_SHA;
    const data = (await res.json()) as { hash?: string };
    return typeof data.hash === "string" ? data.hash : KERNEL_SHA;
  } catch {
    return KERNEL_SHA;
  }
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
    gemini_text?:  string;
    prompt_hash?:  string;
    threat_level?: number;
    asn?:          string;
    path?:         string;
    ray_id?:       string;
    total_tokens?: number;
    model?:        string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body is not valid JSON", 400);
  }

  const { gemini_text, prompt_hash, threat_level, asn, path, ray_id, total_tokens, model } = body;

  if (!gemini_text || typeof gemini_text !== "string") {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "Required field missing", 400);
  }
  if (!prompt_hash || !/^[a-f0-9]{128}$/.test(prompt_hash)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid field value", 400);
  }

  const stampedAt   = formatIso9();
  const btcBlockHash = await fetchBtcBlockHash(cfEnv.BLOCKCHAIN_API_KEY);

  // ── Compute VaultSignature ────────────────────────────────────────────────
  // SHA-512( kernel_sha | btc_block_hash | gemini_text | prompt_hash )
  const vaultSignatureInput = `${KERNEL_SHA}|${btcBlockHash}|${gemini_text}|${prompt_hash}`;
  const vaultSignature      = await sha512hex(vaultSignatureInput);

  // ── Build stamped artifact ─────────────────────────────────────────────────
  const r2Key = `ai-stamps/${vaultSignature}.json`;
  const artifact = {
    vault_signature:  vaultSignature,
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    btc_block_hash:   btcBlockHash,
    prompt_hash,
    gemini_text,
    threat_level:     threat_level ?? null,
    asn:              asn ?? null,
    path:             path ?? null,
    ray_id:           ray_id ?? null,
    total_tokens:     total_tokens ?? null,
    model:            model ?? null,
    stamped_at:       stampedAt,
  };

  // ── Archive to R2 ─────────────────────────────────────────────────────────
  if (cfEnv.VAULT_R2) {
    cfEnv.VAULT_R2.put(r2Key, JSON.stringify(artifact)).catch(() => {
      // Non-blocking — R2 write failure must not surface to callers
    });
  }

  // ── Log to D1 sovereign_audit_logs ────────────────────────────────────────
  if (cfEnv.DB) {
    const timestampNs = Date.now().toString() + "000000";
    cfEnv.DB.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path,
          timestamp_ns, threat_level, tari_liability_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "AI_STAMP",
        asn ?? "UNKNOWN",
        model ?? "gemini",
        asn ?? "UNKNOWN",
        path ?? "/api/v1/forensics/ai-stamp",
        timestampNs,
        threat_level ?? 8,
        0,
      )
      .run()
      .catch(() => {});

    // ── Multi-Cloud: Mirror AI_STAMP to Firebase Firestore (non-blocking) ──
    const tNs = Date.now().toString() + "000000";
    syncD1RowToFirebase({
      id:           tNs,
      event_type:   "AI_STAMP",
      ip_address:   asn ?? "UNKNOWN",
      target_path:  path ?? "/api/v1/forensics/ai-stamp",
      threat_level: threat_level ?? 8,
      timestamp_ns: tNs,
    }).catch(() => {});
  }

  // ── Phase 88: Gemini spend accumulator ──────────────────────────────────
  // Adds the estimated cost of this Gemini call to the monthly KV_LOGS tally.
  // Gemini 1.5 Pro pricing: ~$0.00125 per 1K tokens (blended in/out avg).
  // Note: Cloudflare KV does not support atomic increment; under very high
  // concurrency the tally may undercount slightly. This is acceptable for
  // the Phase 88 circuit-breaker (soft $50/month limit) — not billing-grade.
  if (cfEnv.KV_LOGS && total_tokens && total_tokens > 0) {
    const now = new Date();
    const spendKey = `gemini_monthly_spend_${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    cfEnv.KV_LOGS.get(spendKey).then(async (current) => {
      const prev    = parseFloat(current ?? '0') || 0;
      const cost    = (total_tokens / 1000) * 0.00125;
      await cfEnv.KV_LOGS!.put(spendKey, (prev + cost).toFixed(6));
    }).catch(() => {});
  }

  return Response.json({
    vault_signature: vaultSignature,
    r2_key:          r2Key,
    btc_block_hash:  btcBlockHash,
    kernel_sha:      KERNEL_SHA,
    stamped_at:      stampedAt,
  });
}
