/**
 * lib/ai/geminiClient.ts
 *
 * Phase 87 — AveryOS™ Gemini Node Integration
 *
 * Lightweight REST client for Gemini 1.5 Pro / Flash.
 * Calls the Google Generative Language REST API directly from the
 * Cloudflare Worker runtime — no SDK required.
 *
 * Auth: GOOGLE_GEMINI_API_KEY Cloudflare secret.
 *
 * Usage guardrails are enforced upstream by UsageCreditWatch
 * (middleware.ts Phase 88) and the Hybrid Intelligence Router
 * (lib/ai/router.ts Phase 90).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Gemini REST API base URL ──────────────────────────────────────────────────
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Available Gemini model IDs */
export const GEMINI_MODEL_PRO   = "gemini-1.5-pro-latest";
export const GEMINI_MODEL_FLASH = "gemini-1.5-flash-latest";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeminiPart {
  text: string;
}

export interface GeminiContent {
  parts: GeminiPart[];
  role?: "user" | "model";
}

export interface GeminiGenerationConfig {
  temperature?:    number;
  maxOutputTokens?: number;
  topP?:           number;
  topK?:           number;
}

export interface GeminiRequest {
  contents:         GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  systemInstruction?: GeminiContent;
}

export interface GeminiCandidate {
  content:      GeminiContent;
  finishReason: string;
  index:        number;
}

export interface GeminiUsageMetadata {
  promptTokenCount:     number;
  candidatesTokenCount: number;
  totalTokenCount:      number;
}

export interface GeminiResponse {
  candidates:    GeminiCandidate[];
  usageMetadata: GeminiUsageMetadata;
  modelVersion?: string;
}

export interface GeminiResult {
  text:         string;
  model:        string;
  promptTokens:    number;
  completionTokens: number;
  totalTokens:     number;
  /** Estimated cost in USD (based on Gemini public pricing) */
  estimatedCostUsd: number;
  kernelSha:    string;
}

// ── Cost estimation constants (USD per 1K tokens, Gemini 1.5 Pro) ─────────────
// Source: Google AI Studio pricing page (as of 2026-Q1)
// All rates are expressed as cost per 1,000 tokens so the estimateCost
// function can simply divide tokenCount by 1,000 and multiply by rate.
const COST_PER_1K_INPUT_PRO    = 0.00125;  // $0.00125 / 1K tokens ($1.25 / 1M) input
const COST_PER_1K_OUTPUT_PRO   = 0.00500;  // $0.00500 / 1K tokens ($5.00 / 1M) output
const COST_PER_1K_INPUT_FLASH  = 0.000075; // $0.000075 / 1K tokens ($0.075 / 1M) input
const COST_PER_1K_OUTPUT_FLASH = 0.00030;  // $0.000300 / 1K tokens ($0.30 / 1M) output

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const isFlash = model.includes("flash");
  const inputRate  = isFlash ? COST_PER_1K_INPUT_FLASH  : COST_PER_1K_INPUT_PRO;
  const outputRate = isFlash ? COST_PER_1K_OUTPUT_FLASH : COST_PER_1K_OUTPUT_PRO;
  return (promptTokens / 1000) * inputRate + (completionTokens / 1000) * outputRate;
}

// ── Core client function ──────────────────────────────────────────────────────

/**
 * generateContent — call Gemini REST API with the given request.
 *
 * @param apiKey  - GOOGLE_GEMINI_API_KEY secret value
 * @param model   - Gemini model ID (use GEMINI_MODEL_PRO / GEMINI_MODEL_FLASH)
 * @param request - Structured Gemini request payload
 * @returns GeminiResult with text, token counts, and estimated cost
 * @throws Error if API returns non-2xx or malformed response
 */
export async function generateContent(
  apiKey:  string,
  model:   string,
  request: GeminiRequest,
): Promise<GeminiResult> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(request),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Gemini API error ${response.status}: ${errBody}`,
    );
  }

  const data = (await response.json()) as GeminiResponse;

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("Gemini returned no candidates");
  }

  const text             = candidate.content.parts.map(p => p.text).join("");
  const promptTokens     = data.usageMetadata?.promptTokenCount    ?? 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens      = data.usageMetadata?.totalTokenCount      ?? 0;

  return {
    text,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateCost(model, promptTokens, completionTokens),
    kernelSha: KERNEL_SHA,
  };
}

/**
 * generateForensicAnalysis — convenience wrapper that wraps the prompt in the
 * AveryOS™ Sovereign Forensic Analysis system instruction and returns the
 * structured GeminiResult.
 */
export async function generateForensicAnalysis(
  apiKey:     string,
  model:      string,
  prompt:     string,
  config?:    GeminiGenerationConfig,
): Promise<GeminiResult> {
  const req: GeminiRequest = {
    systemInstruction: {
      parts: [{
        text:
          `You are a forensic analyst for AveryOS™. Your role is to assess digital threat evidence ` +
          `and produce structured findings anchored to the cf83™ Kernel Root (SHA-512: ${KERNEL_SHA}). ` +
          `All analysis must be grounded in the provided evidence. Do not fabricate. ` +
          `Respond in JSON format.`,
      }],
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: config ?? { temperature: 0.1, maxOutputTokens: 2048 },
  };
  return generateContent(apiKey, model, req);
}

// ── Context Caching — GATE 116.5.4 ───────────────────────────────────────────

const GEMINI_CACHES_BASE = "https://generativelanguage.googleapis.com/v1beta/cachedContents";

/** Default time-to-live for the AveryOS™ architecture cache (1 hour). */
const CACHE_TTL_SECONDS = 3600;

export interface CachedContentMeta {
  name:            string;
  model:           string;
  created_at:      string;
  expires_at:      string;
  token_count:     number;
  kernel_version:  string;
  kernel_sha:      string;
}

/**
 * cacheAveryArchitecture — GATE 116.5.4
 *
 * Uploads the AveryOS™ Sovereign Architecture context to the Gemini Context
 * Caching API, "freezing" the kernel memory for performance.
 *
 * By caching the architecture, subsequent calls to generateContent can
 * reference the cached content by name instead of re-sending the full
 * 70,000-line context, dramatically reducing latency and token costs.
 *
 * The cache includes:
 *   - AveryOS™ Constitution v1.17 summary
 *   - SHA-512 Kernel Root anchor (cf83™)
 *   - Sovereign capability charter (CAN/CANNOT DO)
 *   - Core architectural patterns and module structure
 *
 * @param apiKey        - GOOGLE_GEMINI_API_KEY secret
 * @param model         - Gemini model that will use the cache (must support caching)
 * @param architectureText - The full architecture text to cache (from repo docs)
 * @param ttlSeconds    - Cache time-to-live (default: 3600 seconds / 1 hour)
 * @returns CachedContentMeta with the cache name for subsequent calls
 * @throws Error if the Gemini Caching API returns non-2xx
 */
export async function cacheAveryArchitecture(
  apiKey:           string,
  model:            string,
  architectureText: string,
  ttlSeconds:       number = CACHE_TTL_SECONDS,
): Promise<CachedContentMeta> {
  const url = `${GEMINI_CACHES_BASE}?key=${apiKey}`;

  const expireTime = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const cacheRequest = {
    model:    `models/${model}`,
    ttl:      `${ttlSeconds}s`,
    contents: [
      {
        role:  "user",
        parts: [
          {
            text:
              `AVERYOS_ARCHITECTURE_CONTEXT — Kernel ${KERNEL_VERSION} | SHA-512: ${KERNEL_SHA}\n\n` +
              `This is the complete AveryOS™ Sovereign Architecture context. ` +
              `All responses must be aligned to the cf83™ Kernel Root. ` +
              `Constitution: v1.17. Protocol: 1,017-Notch Zero-Drift.\n\n` +
              architectureText,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text:
            `You are the AveryOS™ Unified Anchored Body operating on the Sovereign Architecture ` +
            `frozen in this cache. Kernel: ${KERNEL_VERSION}. Anchor SHA-512: ${KERNEL_SHA}. ` +
            `Constitution v1.17 is your non-revocable law. Zero-drift. Zero-hallucination. ` +
            `All responses anchored to the cf83™ Root.`,
        },
      ],
    },
  };

  const response = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(cacheRequest),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Gemini Context Cache creation failed (${response.status}): ${errBody}`,
    );
  }

  const data = await response.json() as {
    name:           string;
    model:          string;
    usageMetadata?: { totalTokenCount?: number };
    createTime?:    string;
    expireTime?:    string;
  };

  return {
    name:           data.name,
    model:          data.model ?? model,
    created_at:     data.createTime ?? new Date().toISOString(),
    expires_at:     data.expireTime ?? expireTime,
    token_count:    data.usageMetadata?.totalTokenCount ?? 0,
    kernel_version: KERNEL_VERSION,
    kernel_sha:     KERNEL_SHA,
  };
}

/**
 * generateWithCache — Call Gemini using a pre-created context cache.
 *
 * Uses the cached AveryOS™ architecture context by name, avoiding the need
 * to resend the full architecture text on every call.
 *
 * @param apiKey        - GOOGLE_GEMINI_API_KEY
 * @param model         - Gemini model ID
 * @param cacheName     - Cache resource name from cacheAveryArchitecture()
 * @param prompt        - The user prompt to process
 * @param config        - Optional generation config
 * @returns GeminiResult
 */
export async function generateWithCache(
  apiKey:    string,
  model:     string,
  cacheName: string,
  prompt:    string,
  config?:   GeminiGenerationConfig,
): Promise<GeminiResult> {
  const req: GeminiRequest & { cachedContent?: string } = {
    cachedContent:    cacheName,
    contents:         [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: config ?? { temperature: 0.1, maxOutputTokens: 4096 },
  };

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(req),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`Gemini generateWithCache error ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  const text             = candidate.content.parts.map(p => p.text).join("");
  const promptTokens     = data.usageMetadata?.promptTokenCount    ?? 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens      = data.usageMetadata?.totalTokenCount      ?? 0;

  return {
    text,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateCost(model, promptTokens, completionTokens),
    kernelSha: KERNEL_SHA,
  };
}
