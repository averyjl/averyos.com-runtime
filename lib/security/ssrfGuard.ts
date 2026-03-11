/**
 * AveryOS™ SSRF Guard — GabrielOS™ Firewall v1.4
 *
 * Provides buildSsrfSafeUrl() for any route that constructs an outbound URL
 * from user-supplied or agentic-client-supplied input (e.g. webhook callbacks,
 * redirect URLs, or external API endpoints).
 *
 * Usage:
 *   import { buildSsrfSafeUrl, STRIPE_ALLOWLIST } from "lib/security/ssrfGuard";
 *   const safe = buildSsrfSafeUrl(userProvidedUrl, STRIPE_ALLOWLIST);
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Built-in allowlists for first-party integrations ────────────────────────

/** Stripe API hostnames — used by exchange and webhook routes. */
export const STRIPE_ALLOWLIST = new Set([
  "api.stripe.com",
  "hooks.stripe.com",
]);

/** Pushover notification API — used by audit-alert routes. */
export const PUSHOVER_ALLOWLIST = new Set(["api.pushover.net"]);

/** Firebase / Google Cloud — used by D1→Firestore sync routes. */
export const FIREBASE_ALLOWLIST = new Set([
  "firebaseio.com",
  "firestore.googleapis.com",
  "fcm.googleapis.com",
]);

/**
 * Validates that the supplied URL's hostname is present in the provided
 * allowlist, then returns the parsed URL object.
 *
 * @param rawUrl  - The URL string to validate (may come from user/agentic input).
 * @param allowlist - A Set of permitted hostnames.
 * @returns The validated URL object.
 * @throws  {Error} When the URL is malformed or the hostname is not allowlisted.
 *
 * @example
 * // In an agentic webhook-callback route:
 * const callbackUrl = buildSsrfSafeUrl(
 *   body.callback_url,
 *   new Set(["hooks.example.com"])
 * );
 * const response = await fetch(callbackUrl.toString());
 */
export function buildSsrfSafeUrl(rawUrl: string, allowlist: Set<string>): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`SSRF guard: malformed URL — "${rawUrl.slice(0, 120)}"`);
  }

  // Only allow https:// — never plain http, file://, data://, etc.
  if (parsed.protocol !== "https:") {
    throw new Error(
      `SSRF guard: protocol "${parsed.protocol}" not permitted. Only https: is allowed.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject private/loopback ranges via simple hostname prefix checks.
  // Cloudflare Workers cannot resolve internal RFC-1918 addresses anyway,
  // but this guard prevents accidental misconfiguration.
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
  ) {
    throw new Error(`SSRF guard: private/loopback hostname "${hostname}" not permitted.`);
  }

  if (!allowlist.has(hostname)) {
    throw new Error(
      `SSRF guard: hostname "${hostname}" is not in the allowlist. ` +
        `Allowed: ${[...allowlist].join(", ")}`
    );
  }

  return parsed;
}
