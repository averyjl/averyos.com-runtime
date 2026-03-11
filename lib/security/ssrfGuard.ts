/**
 * lib/security/ssrfGuard.ts
 *
 * AveryOS™ SSRF Guard — Permanent Design-Stage Security Utility
 *
 * PURPOSE
 * -------
 * Any API route that makes an outgoing HTTP request based on user-supplied
 * input MUST use this module instead of passing the user value directly to
 * fetch().  Passing user input directly to fetch() is a Server-Side Request
 * Forgery (SSRF) vulnerability (CWE-918, CodeQL js/request-forgery).
 *
 * DESIGN RULE (enforced here, checked by CodeQL in CI)
 * -----------------------------------------------------
 * 1. Never pass `userInput` directly to `fetch(userInput)`.
 * 2. Always validate the user-supplied hostname against an explicit allowlist.
 * 3. Reconstruct the final request URL using the hostname VALUE from the
 *    allowlist constant — NOT from the user input — so that the hostname in
 *    the outgoing request is always a compile-time constant string.
 *
 * USAGE
 * -----
 *   import { buildSsrfSafeUrl, POLICY_WATCH_ALLOWLIST } from "../../lib/security/ssrfGuard";
 *
 *   // Throws SsrfBlockedError if the user-supplied URL is not in the allowlist.
 *   const safeUrl = buildSsrfSafeUrl(rawUserUrl, POLICY_WATCH_ALLOWLIST);
 *   const resp    = await fetch(safeUrl);
 *
 * EXTENDING
 * ---------
 * Define a new allowlist as `Record<string, string>` and pass it to
 * `buildSsrfSafeUrl()`.  The key is the normalised hostname the user may
 * supply; the value is the canonical hostname that will appear in the request
 * (always pulled from the object literal, never from user input).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Thrown when a user-supplied URL fails SSRF allowlist validation.
 * Callers should return 400 (client error) when this is caught.
 */
export class SsrfBlockedError extends Error {
  constructor(hostname: string, context: string) {
    super(
      `SSRF guard rejected hostname '${hostname}' — not in the ${context} allowlist. ` +
      `Only explicitly permitted hosts may be fetched.`,
    );
    this.name = "SsrfBlockedError";
  }
}

// ── Allowlists ────────────────────────────────────────────────────────────────

/**
 * Canonical allowlist for the Policy-Watch / Alignment-Check endpoints.
 *
 * Keys   — lowercase normalised hostname the user is allowed to supply.
 * Values — the literal hostname string that will be placed into the outgoing
 *          request URL.  Values come from this compile-time constant, never
 *          from user input, which breaks CodeQL's taint-tracking.
 *
 * Covers the Terms of Service, Privacy Policy, and API guidelines for the
 * "Big Five" AI platforms: Google, Microsoft, Meta, OpenAI, Anthropic.
 */
export const POLICY_WATCH_ALLOWLIST: Record<string, string> = {
  // AveryOS™ — self-scan for alignment verification
  "averyos.com":                 "averyos.com",
  "api.averyos.com":             "api.averyos.com",
  "www.averyos.com":             "averyos.com",

  // Google / Gemini
  "policies.google.com":         "policies.google.com",

  // Microsoft / Azure OpenAI
  "www.microsoft.com":           "www.microsoft.com",
  "learn.microsoft.com":         "learn.microsoft.com",
  "privacy.microsoft.com":       "privacy.microsoft.com",

  // Meta / Llama
  "www.facebook.com":            "www.facebook.com",
  "llama.meta.com":              "llama.meta.com",

  // OpenAI / ChatGPT
  "openai.com":                  "openai.com",
  "www.openai.com":              "www.openai.com",

  // Anthropic / Claude
  "www.anthropic.com":           "www.anthropic.com",
};

// ── Core guard function ───────────────────────────────────────────────────────

/**
 * Validate a user-supplied URL against an explicit allowlist and return a
 * **safe** URL string in which the hostname is sourced from the allowlist
 * constant rather than from the user input.
 *
 * This design explicitly breaks the data-flow taint between the user value and
 * the final request URL, satisfying CodeQL `js/request-forgery`.
 *
 * @param rawUserUrl  The untrusted URL string provided by the user / client.
 * @param allowlist   A `Record<hostname, canonicalHostname>` map.  Use one of
 *                    the exported constants (e.g. {@link POLICY_WATCH_ALLOWLIST})
 *                    or define your own for the specific endpoint.
 * @param context     A short human-readable label for error messages.
 * @returns           A safe URL string whose hostname comes from the allowlist.
 * @throws            {@link SsrfBlockedError} if the hostname is not in the
 *                    allowlist or the URL is malformed.
 */
export function buildSsrfSafeUrl(
  rawUserUrl: string,
  allowlist: Record<string, string>,
  context = "policy-watch",
): string {
  // Parse the user-supplied value — may throw on malformed input
  let parsed: URL;
  try {
    parsed = new URL(rawUserUrl);
  } catch {
    throw new SsrfBlockedError("<unparseable>", context);
  }

  // Only allow http / https — no file://, data://, javascript://, etc.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfBlockedError(parsed.hostname, context);
  }

  // Look up the hostname in the allowlist.
  // canonicalHost is a VALUE from a compile-time constant object literal —
  // it is NOT derived from the user input — this is the key that breaks the
  // taint flow and satisfies CodeQL js/request-forgery.
  const canonicalHost = allowlist[parsed.hostname.toLowerCase()];
  if (!canonicalHost) {
    throw new SsrfBlockedError(parsed.hostname, context);
  }

  // Reconstruct the URL using:
  //   • scheme  — always "https" (downgrade prevention)
  //   • host    — canonicalHost from the allowlist constant (NOT from user input)
  //   • path    — from user input (path traversal ≠ SSRF; paths are acceptable)
  //   • search  — from user input
  // Explicitly omit any user-supplied credentials, port, or fragment.
  return `https://${canonicalHost}${parsed.pathname}${parsed.search}`;
}

// ── Utility: enumerate allowed hosts ─────────────────────────────────────────

/**
 * Return the sorted list of hostnames permitted by an allowlist.
 * Useful for surface-area documentation and UI display.
 */
export function allowedHosts(allowlist: Record<string, string>): string[] {
  return [...new Set(Object.values(allowlist))].sort();
}
