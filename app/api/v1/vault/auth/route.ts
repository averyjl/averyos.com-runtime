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
 * POST /api/v1/vault/auth
 *
 * Validates the VAULTAUTH_TOKEN and, on success, sets an HttpOnly Secure
 * cookie (`aos-vault-auth`) so subsequent admin requests are authenticated
 * without storing the token in browser-accessible sessionStorage.
 *
 * Request body: { "token": "<VAULT_PASSPHRASE>" }
 * On success   : 200 OK + Set-Cookie: aos-vault-auth=<token>; HttpOnly; Secure; SameSite=Strict
 * On failure   : 401 Unauthorized
 *
 * DELETE /api/v1/vault/auth — clears the cookie (logout).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';
import { VAULT_COOKIE_NAME } from '../../../../../lib/vaultCookieConfig';

interface CloudflareEnv {
  VAULT_PASSPHRASE?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
/** Max-age for the vault auth cookie in seconds. Configurable via VAULT_COOKIE_TTL_SECONDS. */
const VAULT_COOKIE_MAX_AGE_SEC =
  parseInt(process.env.VAULT_COOKIE_TTL_SECONDS ?? "", 10) || 4 * 60 * 60; // default: 4 hours

// Cookie settings — Secure flag is set on production; HttpOnly always.
function buildCookieHeader(token: string, maxAgeSec: number): string {
  const parts = [
    `${VAULT_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=${maxAgeSec}`,
  ];
  // Add Secure flag when running on HTTPS (always true in Cloudflare Workers).
  if (process.env.NODE_ENV !== "development") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string };
    const submittedToken = (body.token ?? "").trim();

    if (!submittedToken) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Token is required", 401);
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;
    const expected = (cfEnv.VAULT_PASSPHRASE ?? "").trim();

    if (!expected || submittedToken !== expected) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Invalid VAULTAUTH_TOKEN", 401);
    }

    // Auth succeeded — set an HttpOnly Secure cookie for the configured TTL.
    return new Response(JSON.stringify({ ok: true, message: "Authenticated" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": buildCookieHeader(submittedToken, VAULT_COOKIE_MAX_AGE_SEC),
      },
    });
  } catch (err) {
    return aosErrorResponse(
      AOS_ERROR.UNKNOWN,
      err instanceof Error ? err.message : "Auth check failed",
      500
    );
  }
}

/** DELETE /api/v1/vault/auth — clears the vault auth cookie (logout). */
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true, message: "Logged out" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Expire the cookie immediately.
      "Set-Cookie": buildCookieHeader("", 0),
    },
  });
}
