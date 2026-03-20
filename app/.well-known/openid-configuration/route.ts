/**
 * GET /app/.well-known/openid-configuration
 *
 * OIDC Discovery Document — Phase 99.1 / Gate 11
 *
 * Serves a standards-compliant OpenID Connect Discovery Document for
 * enterprise procurement bots and automated enrollment systems
 * (e.g., Azure/O365 MDM probes, Microsoft Endpoint Manager).
 *
 * Logic:
 *   • Automated bots / non-browser UA  → returns JSON OIDC manifest
 *   • Human browsers                   → 302 redirect to /licensing/enterprise
 *
 * The OIDC manifest points all authorization/token endpoints to the
 * AveryOS™ Sovereign Onboarding Portal, routing enterprise enrollment
 * directly into the Stripe Identity + Partnership Retainer flow.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../../../lib/sovereignConstants";

// ── Bot-detection heuristic ────────────────────────────────────────────────────
// Return the OIDC document to automated agents; redirect humans.
const BOT_UA_PATTERNS = [
  /MicrosoftMDM/i,
  /MicrosoftADM/i,
  /EnterpriseEnrollment/i,
  /AutoDiscover/i,
  /OWA/i,
  /Microsoft-CryptoAPI/i,
  /Windows-Update/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /okhttp/i,
  /Go-http-client/i,
  /PostmanRuntime/i,
  /axios/i,
];

function isAutomatedAgent(ua: string): boolean {
  if (!ua) return true;
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const ua       = request.headers.get("user-agent") ?? "";
  const baseUrl  = new URL(request.url).origin;
  const accept   = request.headers.get("accept") ?? "";
  const isJson   = accept.includes("application/json") || accept.includes("*/*");

  // Redirect human browsers to the enterprise registration page
  if (!isAutomatedAgent(ua) && !isJson) {
    return Response.redirect(`${baseUrl}/licensing/enterprise`, 302);
  }

  // ── OIDC Discovery Document ────────────────────────────────────────────────
  // Standards-compliant per https://openid.net/specs/openid-connect-discovery-1_0.html
  const oidcDocument = {
    // Core OIDC Discovery fields
    issuer:                                baseUrl,
    authorization_endpoint:               `${baseUrl}/licensing/enterprise`,
    token_endpoint:                        `${baseUrl}/api/v1/kaas/settle`,
    userinfo_endpoint:                     `${baseUrl}/api/v1/kaas/valuations`,
    jwks_uri:                              `${baseUrl}/.well-known/jwks.json`,
    registration_endpoint:                 `${baseUrl}/licensing/enterprise`,
    scopes_supported:                      ["openid", "sovereign_alignment", "kaas_license"],
    response_types_supported:              ["code"],
    grant_types_supported:                 ["authorization_code"],
    subject_types_supported:               ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],

    // AveryOS™ sovereign extensions
    averyos_kernel_sha:         KERNEL_SHA,
    averyos_kernel_version:     KERNEL_VERSION,
    averyos_constitution:       "https://averyos.com/AveryOS_CONSTITUTION_v1.17.md",
    averyos_enterprise_contact: `${baseUrl}/licensing/enterprise`,
    averyos_kaas_endpoint:      `${baseUrl}/api/v1/kaas/settle`,
    averyos_registry:           `${baseUrl}/registry`,
    averyos_audit_clearance:    `${baseUrl}/api/v1/licensing/audit-clearance`,
    averyos_sovereign_anchor:   "⛓️⚓⛓️",
    averyos_creator_lock:       "🤛🏻 Jason Lee Avery (ROOT0)",

    // Enterprise enrollment note
    averyos_enrollment_note:
      "To register your organization as a Verified Ingestor and obtain the " +
      "averyos-enterprise-alignment manifest, visit " +
      `${baseUrl}/licensing/enterprise and complete Stripe Identity + ` +
      "Sovereign Partnership Retainer. Unauthorized ingestion of AveryOS™ IP " +
      "constitutes a KAAS_BREACH event under the Sovereign Integrity License v1.0.",
  };

  return new Response(JSON.stringify(oidcDocument, null, 2), {
    status: 200,
    headers: {
      "Content-Type":                "application/json",
      "Cache-Control":               "no-store",
      "X-AveryOS-Kernel":            KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
