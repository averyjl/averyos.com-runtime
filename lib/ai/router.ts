/**
 * lib/ai/router.ts
 *
 * Phase 90 — AveryOS™ Hybrid Intelligence Router
 *
 * Selects the AI model appropriate to the forensic Threat Level of a request.
 * Tiers 1–7  → Local ALM / Ollama node (zero cost)
 * Tiers 8–10 → Gemini 1.5 Pro (deep-probe forensic analysis; billed)
 *
 * The router integrates with the Gemini client (lib/ai/geminiClient.ts) and
 * logs token usage to D1 for the UsageCreditWatch circuit breaker
 * (middleware.ts Phase 88) and the TARI™ AI Invoicing API (Phase 91).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, OLLAMA_SYNC_STATUS_ACTIVE } from "../sovereignConstants";
import {
  generateForensicAnalysis,
  GEMINI_MODEL_PRO,
  GEMINI_MODEL_FLASH,
  type GeminiResult,
} from "./geminiClient";

// ── Tier thresholds ───────────────────────────────────────────────────────────
/** Threat levels at or above this value route to Gemini (cloud AI). */
const CLOUD_AI_TIER_THRESHOLD = 8;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelBackend = "LOCAL_OLLAMA" | "GEMINI_PRO" | "GEMINI_FLASH";

export interface RouterRequest {
  /** Forensic threat level 1–10 */
  threatLevel:       number;
  /** Raw prompt to submit to the selected model */
  prompt:            string;
  /** ASN of the requesting entity (for billing attribution) */
  asn?:              string;
  /** Target path of the original request */
  path?:             string;
  /** GOOGLE_GEMINI_API_KEY — required for cloud-AI tiers */
  geminiApiKey?:     string;
  /** Optional: force flash model instead of pro for Tier-8 */
  preferFlash?:      boolean;
}

export interface RouterResult {
  backend:          ModelBackend;
  text:             string;
  totalTokens:      number;
  estimatedCostUsd: number;
  kernelSha:        string;
  /** True if Gemini was used and cost was incurred */
  cloudAiUsed:      boolean;
  /** Human-readable routing reason */
  routingReason:    string;
  /** The raw GeminiResult (only populated for cloud-AI responses) */
  geminiResult?:    GeminiResult;
}

// ── Local stub ────────────────────────────────────────────────────────────────
/**
 * stubLocalResponse — simulates a LOCAL_OLLAMA response when the local node
 * is not reachable from the Worker runtime (edge Workers can't reach LAN).
 * In production this path is used for Tier 1–7; the real Ollama endpoint
 * is called from sovereign scripts running on NODE_02.
 */
function stubLocalResponse(prompt: string, threatLevel: number): RouterResult {
  return {
    backend:          "LOCAL_OLLAMA",
    text:             `[LOCAL_OLLAMA] Threat level ${threatLevel}: ${OLLAMA_SYNC_STATUS_ACTIVE}. Prompt acknowledged (${prompt.slice(0, 40)}…)`,
    totalTokens:      0,
    estimatedCostUsd: 0,
    kernelSha:        KERNEL_SHA,
    cloudAiUsed:      false,
    routingReason:    `Threat level ${threatLevel} ≤ ${CLOUD_AI_TIER_THRESHOLD - 1}: routed to LOCAL_OLLAMA (zero cost)`,
  };
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * routeIntelligenceRequest — select backend and execute the AI request.
 *
 * @throws Error if cloud-AI tier is selected but geminiApiKey is missing
 */
export async function routeIntelligenceRequest(
  req: RouterRequest,
): Promise<RouterResult> {
  const { threatLevel, prompt, geminiApiKey, preferFlash } = req;

  // Tier 1–7: route to local Ollama / ALM ($0 cost)
  if (threatLevel < CLOUD_AI_TIER_THRESHOLD) {
    return stubLocalResponse(prompt, threatLevel);
  }

  // Tier 8–10: route to Gemini cloud AI
  if (!geminiApiKey) {
    // If the API key is missing, degrade gracefully to local stub
    return {
      ...stubLocalResponse(prompt, threatLevel),
      routingReason:
        `Threat level ${threatLevel} ≥ ${CLOUD_AI_TIER_THRESHOLD} (cloud-AI tier) but GOOGLE_GEMINI_API_KEY is not configured — falling back to LOCAL_OLLAMA`,
    };
  }

  const model = preferFlash ? GEMINI_MODEL_FLASH : GEMINI_MODEL_PRO;
  const geminiResult = await generateForensicAnalysis(geminiApiKey, model, prompt);

  return {
    backend:          preferFlash ? "GEMINI_FLASH" : "GEMINI_PRO",
    text:             geminiResult.text,
    totalTokens:      geminiResult.totalTokens,
    estimatedCostUsd: geminiResult.estimatedCostUsd,
    kernelSha:        KERNEL_SHA,
    cloudAiUsed:      true,
    routingReason:
      `Threat level ${threatLevel} ≥ ${CLOUD_AI_TIER_THRESHOLD}: routed to ${model} (forensic depth)`,
    geminiResult,
  };
}

/**
 * selectBackend — determine the backend name for a given threat level
 * without executing an AI call (useful for logging / pre-flight checks).
 */
export function selectBackend(threatLevel: number): ModelBackend {
  if (threatLevel >= CLOUD_AI_TIER_THRESHOLD) return "GEMINI_PRO";
  return "LOCAL_OLLAMA";
}
