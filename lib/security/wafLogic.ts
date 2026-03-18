/**
 * lib/security/wafLogic.ts
 *
 * GabrielOS™ WAF Interception Logic — Phase 97.2
 *
 * Provides edge-level WAF score evaluation utilities that can be consumed by
 * middleware.ts (Cloudflare Worker) to intercept high-risk requests without
 * requiring a paid Cloudflare WAF Managed Rules subscription.
 *
 * Strategy:
 *   - Cloudflare's bot management assigns `cf-waf-attack-score` (0-100) in
 *     the request headers on eligible plans.
 *   - We use this FREE signal to drive our own custom enforcement.
 *   - Score > 80 → redirect to /licensing/audit-clearance (or block).
 *   - Score > 95 → immediate 403 with sovereign block response.
 *   - /evidence-vault/* paths → auto-redirect to audit-clearance on any score > 60.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA } from "../sovereignConstants";

// ── Score Thresholds ───────────────────────────────────────────────────────────
export const WAF_BLOCK_THRESHOLD     = 95;  // Hard block — 403
export const WAF_CHALLENGE_THRESHOLD = 80;  // Soft redirect to audit-clearance
export const WAF_EVIDENCE_THRESHOLD  = 60;  // Lower threshold for /evidence-vault

// ── Protected Path Patterns ────────────────────────────────────────────────────
/** Paths that use a lower WAF score threshold for redirects. */
export const WAF_SENSITIVE_PATHS = [
  "/evidence-vault",
  "/api/v1/vault",
  "/api/v1/forensics",
];

/** The sovereign redirect target for audit clearance challenges. */
export const AUDIT_CLEARANCE_PATH = "/licensing/audit-clearance";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WafEvalResult {
  action:    "allow" | "challenge" | "block";
  score:     number;
  reason?:   string;
  redirectTo?: string;
}

// ── Core Evaluation ───────────────────────────────────────────────────────────

/**
 * Parse the Cloudflare WAF attack score from request headers.
 * Returns null if the header is absent or non-numeric.
 *
 * Cloudflare sets `cf-waf-attack-score` on eligible plans.
 * `x-waf-score` is a custom forwarding header that can be set by upstream
 * Cloudflare Workers or test harnesses to test WAF scores in local dev.
 */
export function parseWafScore(headers: Headers): number | null {
  const raw = headers.get("cf-waf-attack-score") ?? headers.get("x-waf-score");
  if (!raw) return null;
  const score = parseInt(raw, 10);
  return isNaN(score) ? null : score;
}

/**
 * Evaluate a request URL path + WAF score and return the enforcement action.
 *
 * @param pathname  URL pathname (e.g. "/evidence-vault/bundle-001")
 * @param score     WAF attack score (0-100, null = not present)
 */
export function evaluateWafScore(pathname: string, score: number | null): WafEvalResult {
  // No score header — allow (score unavailable on free plans for some routes)
  if (score === null) {
    return { action: "allow", score: 0 };
  }

  // Hard block for extreme scores regardless of path
  if (score > WAF_BLOCK_THRESHOLD) {
    return {
      action:  "block",
      score,
      reason:  `WAF attack score ${score} exceeds hard block threshold ${WAF_BLOCK_THRESHOLD}.`,
    };
  }

  // Sensitive path — lower redirect threshold
  const isSensitive = WAF_SENSITIVE_PATHS.some((p) => pathname.startsWith(p));
  const threshold   = isSensitive ? WAF_EVIDENCE_THRESHOLD : WAF_CHALLENGE_THRESHOLD;

  if (score > threshold) {
    return {
      action:     "challenge",
      score,
      reason:     `WAF attack score ${score} exceeds ${isSensitive ? "sensitive-path" : "standard"} threshold ${threshold}.`,
      redirectTo: AUDIT_CLEARANCE_PATH,
    };
  }

  return { action: "allow", score };
}

// ── Response Builders ─────────────────────────────────────────────────────────

/**
 * Build a 403 sovereign block response for hard-blocked requests.
 */
export function buildWafBlockResponse(score: number): Response {
  return new Response(
    JSON.stringify({
      error:           "SOVEREIGN_WAF_BLOCK",
      message:
        "This request has been blocked by GabrielOS™ Sovereign Firewall. " +
        "Your WAF attack score exceeds the sovereign block threshold. " +
        "To obtain audit clearance, visit https://averyos.com/licensing/audit-clearance.",
      waf_score:       score,
      kernel_sha:      KERNEL_SHA.slice(0, 16) + "…",
      sovereign_gate:  "GabrielOS™ v1.6 ⛓️⚓⛓️",
      creator_lock:    "🤛🏻 Jason Lee Avery (ROOT0)",
    }),
    {
      status:  403,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}

/**
 * Build a 302 redirect response to the audit clearance page.
 */
export function buildWafChallengeRedirect(score: number, siteUrl: string): Response {
  const target = new URL(AUDIT_CLEARANCE_PATH, siteUrl);
  target.searchParams.set("waf_score", String(score));
  target.searchParams.set("source", "waf_challenge");
  return Response.redirect(target.toString(), 302);
}

/**
 * Convenience: given a Request and site URL, evaluate and return the
 * appropriate Response or null (= allow, continue processing).
 */
export function applyWafGate(request: Request, siteUrl: string): Response | null {
  const score    = parseWafScore(request.headers);
  const url      = new URL(request.url);
  const result   = evaluateWafScore(url.pathname, score);

  if (result.action === "block")     return buildWafBlockResponse(result.score);
  if (result.action === "challenge") return buildWafChallengeRedirect(result.score, siteUrl);
  return null;
}
