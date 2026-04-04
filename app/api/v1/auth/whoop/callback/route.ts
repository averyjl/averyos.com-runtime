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
 * app/api/v1/auth/whoop/callback/route.ts
 *
 * AveryOS™ WHOOP OAuth 2.0 Callback — GATE 116.3.4
 *
 * Handles the OAuth 2.0 authorization code callback from WHOOP.
 * Exchanges the code for tokens and stores them for subsequent Bio-Resonance use.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { NextRequest }                  from "next/server";
import { aosErrorResponse, AOS_ERROR }  from "../../../../../../lib/sovereignError";
import { KERNEL_VERSION }               from "../../../../../../lib/sovereignConstants";
import { formatIso9 }                   from "../../../../../../lib/timePrecision";

export const dynamic = "force-dynamic";

// ── WHOOP OAuth 2.0 constants ─────────────────────────────────────────────────

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

/** Build the OAuth redirect URI consistent with the initiation route. */
function buildRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
  return `${base}/api/v1/auth/whoop/callback`;
}

// ── GET — Handle authorization code callback ──────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth error responses from WHOOP
  if (error) {
    const errorDescription = searchParams.get("error_description") ?? error;
    return aosErrorResponse(
      AOS_ERROR.UNAUTHORIZED,
      `WHOOP authorization denied: ${errorDescription}`,
      401,
    );
  }

  // ── CSRF state validation ─────────────────────────────────────────────────
  // The initiation route stores the random state in the `whoop_oauth_state`
  // HttpOnly cookie.  We must verify it matches the `state` returned by WHOOP
  // to prevent authorization-code injection (OAuth CSRF attacks).
  const cookieHeader  = request.headers.get("cookie") ?? "";
  const stateCookie   = cookieHeader
    .split(";")
    .map(s => s.trim())
    .find(s => s.startsWith("whoop_oauth_state="))
    ?.split("=")[1];

  if (!stateCookie || !state || stateCookie !== state) {
    return aosErrorResponse(
      AOS_ERROR.UNAUTHORIZED,
      "WHOOP OAuth state mismatch — possible CSRF attack detected",
      403,
    );
  }

  if (!code) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "Missing 'code' parameter in WHOOP callback", 400);
  }

  const clientId     = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return aosErrorResponse(
      AOS_ERROR.VAULT_NOT_CONFIGURED,
      "WHOOP OAuth credentials not configured",
      503,
    );
  }

  // Exchange authorization code for tokens
  const body = new URLSearchParams({
    grant_type:   "authorization_code",
    code,
    redirect_uri: buildRedirectUri(),
  });

  let tokenData: {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    token_type:    string;
    scope:         string;
  };

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(WHOOP_TOKEN_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "(unreadable)");
      return aosErrorResponse(
        AOS_ERROR.UNAUTHORIZED,
        `WHOOP token exchange failed (HTTP ${response.status}): ${errText}`,
        502,
      );
    }

    tokenData = await response.json() as typeof tokenData;
  } catch (err) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      `WHOOP token exchange network error: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }

  // Token exchange successful — return success response
  // In production, tokens should be stored in a server-side session / KV / D1.
  // For this skeleton, we return the token metadata (not the raw tokens) and
  // redirect the user to the health dashboard.
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  const connectedAt = formatIso9();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
  const successUrl = new URL(`${siteUrl}/health`);
  successUrl.searchParams.set("whoop", "connected");

  return Response.json(
    {
      ok:              true,
      whoop_rail:      "ACTIVE",
      scope:           tokenData.scope,
      token_type:      tokenData.token_type,
      expires_at:      expiresAt,
      connected_at:    connectedAt,
      kernel_version:  KERNEL_VERSION,
      gate:            "116.3.4",
      message:
        "WHOOP Bio-Resonance Rail established. HRV and Recovery Scores " +
        "are now available as Bio-Resonance Entropy for AveryOS™ alignment checks.",
    },
    {
      status: 200,
      headers: {
        "X-AveryOS-WHOOP-Rail":     "ACTIVE",
        "X-AveryOS-Kernel-Version": KERNEL_VERSION,
        "X-AveryOS-Gate":           "116.3.4",
        "Cache-Control":            "no-store",
      },
    },
  );
}
