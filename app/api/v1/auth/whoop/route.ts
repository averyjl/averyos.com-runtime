/**
 * app/api/v1/auth/whoop/route.ts
 *
 * AveryOS™ WHOOP Bio-Metric OAuth 2.0 Rail — GATE 116.3.4
 *
 * Initiates and handles the WHOOP OAuth 2.0 authorization flow.
 *
 * Endpoints:
 *   GET  /api/v1/auth/whoop          — Initiate OAuth: redirect to WHOOP authorization page.
 *   GET  /api/v1/auth/whoop/callback — Handle OAuth callback: exchange code for tokens.
 *
 * Environment variables required:
 *   WHOOP_CLIENT_ID      — OAuth Client ID from WHOOP Developer Dashboard
 *   WHOOP_CLIENT_SECRET  — OAuth Client Secret from WHOOP Developer Dashboard
 *   NEXT_PUBLIC_SITE_URL — Base URL for constructing the redirect URI
 *
 * Scopes requested:
 *   read:recovery   — HRV and Recovery Scores for Bio-Resonance Entropy
 *   read:profile    — User identity for sovereign attestation
 *   offline         — Refresh token for persistent access
 *
 * Purpose:
 *   HRV (Heart Rate Variability) and Recovery Scores collected via WHOOP are
 *   used as Bio-Resonance Entropy, ensuring the AveryOS™ Kernel only unlocks
 *   when the Creator's physical health and spirit are Healthy and Aligned.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { NextRequest }                from "next/server";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_VERSION }              from "../../../../../lib/sovereignConstants";

// ── WHOOP OAuth 2.0 constants ─────────────────────────────────────────────────

const WHOOP_AUTH_BASE     = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_SCOPES        = ["read:recovery", "read:profile", "offline"].join(" ");

/** Build the OAuth redirect URI for the current environment. */
function buildRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
  return `${base}/api/v1/auth/whoop/callback`;
}

// ── GET — Initiate OAuth flow ─────────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<Response> {
  const clientId = process.env.WHOOP_CLIENT_ID;
  if (!clientId) {
    return aosErrorResponse(
      AOS_ERROR.VAULT_NOT_CONFIGURED,
      "WHOOP_CLIENT_ID is not configured. Register an AveryOS Client in the WHOOP Developer Dashboard.",
      503,
    );
  }

  // Generate a cryptographically random state parameter to prevent CSRF
  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const redirectUri = buildRedirectUri();

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         WHOOP_SCOPES,
    state,
  });

  const authUrl = `${WHOOP_AUTH_BASE}?${params.toString()}`;

  // Store the CSRF state in a short-lived HttpOnly cookie so the callback can validate it.
  // SameSite=Lax is appropriate for OAuth flows where the redirect returns to this origin.
  const response = Response.redirect(authUrl, 302);
  response.headers.set(
    "Set-Cookie",
    `whoop_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/api/v1/auth/whoop; Max-Age=600`,
  );
  return response;
}

// ── GET /callback — Handle OAuth callback ────────────────────────────────────

/**
 * Named export for the callback sub-route.
 * Next.js App Router does not support sub-path handlers in the same file,
 * so the callback is handled by reading the `pathname` and routing internally.
 *
 * The callback URL is: GET /api/v1/auth/whoop/callback
 * Next.js will route this to a separate route.ts in the /callback sub-directory.
 * This file handles the base /whoop path (initiation only).
 *
 * See: app/api/v1/auth/whoop/callback/route.ts
 */
export const dynamic = "force-dynamic";

// ── Health check — confirm WHOOP OAuth is configured ─────────────────────────

export async function HEAD(): Promise<Response> {
  const configured = !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
  return new Response(null, {
    status: configured ? 200 : 503,
    headers: {
      "X-AveryOS-WHOOP-Rail":    configured ? "CONFIGURED" : "PENDING_CREDENTIALS",
      "X-AveryOS-Kernel-Version": KERNEL_VERSION,
      "X-AveryOS-Gate":           "116.3.4",
    },
  });
}
