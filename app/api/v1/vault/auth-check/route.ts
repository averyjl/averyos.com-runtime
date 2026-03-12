/**
 * GET /api/v1/vault/auth-check
 *
 * Dedicated cookie-validation endpoint used by admin pages on mount to
 * determine whether the browser already holds a valid `aos-vault-auth`
 * HttpOnly Secure cookie (set by a prior POST /api/v1/vault/auth login).
 *
 * Returns:
 *   200  { authenticated: true }  — cookie present and valid
 *   401  aosErrorResponse         — cookie absent, expired, or invalid
 *
 * This endpoint does NOT return any data. It exists solely so admin pages
 * can probe auth state without fetching real API data as a side-effect —
 * the recommended best practice per code-review feedback on CodeQL alert #26.
 *
 * Dynamic pattern:
 *   All admin pages import useVaultAuth() from lib/hooks/useVaultAuth.ts.
 *   That hook calls this endpoint on mount. No manual wiring required.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { VAULT_COOKIE_NAME } from "../../../../../lib/vaultCookieConfig";
import { safeEqual } from "../../../../../lib/taiLicenseGate";

interface CloudflareEnv {
  VAULT_PASSPHRASE?: string;
}

// ── Cookie parsing helper ──────────────────────────────────────────────────────

/** Extract a named cookie value from a raw Cookie header string. */
function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey?.trim() === name) {
      return rest.join("=").trim() || null;
    }
  }
  return null;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieValue  = parseCookie(cookieHeader, VAULT_COOKIE_NAME);

    if (!cookieValue) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Not authenticated", 401);
    }

    const { env }   = await getCloudflareContext({ async: true });
    const cfEnv     = env as unknown as CloudflareEnv;
    const expected  = (cfEnv.VAULT_PASSPHRASE ?? "").trim();

    if (!expected || !safeEqual(decodeURIComponent(cookieValue), expected)) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Not authenticated", 401);
    }

    return new Response(JSON.stringify({ authenticated: true }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return aosErrorResponse(
      AOS_ERROR.UNKNOWN,
      err instanceof Error ? err.message : "Auth check failed",
      500
    );
  }
}
