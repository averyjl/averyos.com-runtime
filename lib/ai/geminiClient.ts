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

import { KERNEL_SHA } from "../sovereignConstants";

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
