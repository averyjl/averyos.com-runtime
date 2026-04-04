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
 * GET /.well-known/averyos.json
 *
 * AveryOS™ DID / Sovereign Identity Document — Phase 117 GATE 117.6.2
 *
 * Serves a machine-readable DID-style document that:
 *   • Identifies averyos.com as the sovereign AveryOS™ runtime mesh node.
 *   • Provides a `vaultchain_live_url` pointer to the Firebase live audit stream
 *     (Firestore `vaultchain_anchors` collection), enabling cross-cloud
 *     verification that the physical site and cloud mirror are the same
 *     Sovereign Mesh.
 *   • Signs the response payload with a SHA-512 hash using the
 *     `averyos-sovereign-key-v3.6.2` JWKS key identifier, proving kernel
 *     alignment at the time of serving.
 *
 * Logic:
 *   • Automated agents / JSON-accepting clients → full DID document + SHA-512 sig.
 *   • Human browsers without Accept: application/json → redirect to /the-proof.
 *
 * Cache-Control: max-age=300 (5 min) — balances bot-crawl freshness vs. D1 load.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }       from "@opennextjs/cloudflare";
import { getSovereignKeys }           from "../../../lib/security/keys";
import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH, KERNEL_SHA256_BRIDGE } from "../../../lib/sovereignConstants";

// ── Constants ─────────────────────────────────────────────────────────────────

const AVERYOS_RELYING_PARTY_ID = "averyos.com";
const KEY_ID                   = "averyos-sovereign-key-v3.6.2";

/**
 * Derive the Firebase Firestore live audit stream URL from the project ID.
 * Returns a REST API URL to the `vaultchain_anchors` collection that any
 * bot hitting /.well-known/averyos.json can follow to reach the live stream.
 *
 * Falls back to the disclosure mirror path when Firebase is not configured.
 */
function buildVaultchainLiveUrl(
  baseUrl: string,
  firebaseProjectId: string | undefined,
): string {
  if (firebaseProjectId) {
    return (
      `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
      `/databases/(default)/documents/vaultchain_anchors` +
      `?orderBy=timestamp%20desc&pageSize=10`
    );
  }
  // Firebase not yet configured — point to the public disclosure page
  return `${baseUrl}${DISCLOSURE_MIRROR_PATH}`;
}

/**
 * Compute the SHA-512 hex digest of an arbitrary string.
 * Uses Web Crypto (available in both Workers and Node.js 18+).
 */
async function sha512hex(input: string): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Bot-UA detection ──────────────────────────────────────────────────────────

const BOT_UA_PATTERNS = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /okhttp/i,
  /Go-http-client/i,
  /PostmanRuntime/i,
  /axios/i,
  /Googlebot/i,
  /Bingbot/i,
  /baiduspider/i,
  /DuckDuckBot/i,
  /facebookexternalhit/i,
  /LinkedInBot/i,
  /Twitterbot/i,
  /node-fetch/i,
  /undici/i,
];

function isAutomatedAgent(ua: string): boolean {
  if (!ua) return true;
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const ua      = request.headers.get("user-agent") ?? "";
  const accept  = request.headers.get("accept")     ?? "";
  const baseUrl = new URL(request.url).origin;
  const isJson  = accept.includes("application/json") || accept.includes("*/*");

  // Redirect human browsers to the public proof / disclosure page
  if (!isAutomatedAgent(ua) && !isJson) {
    return Response.redirect(`${baseUrl}/the-proof`, 302);
  }

  // ── Resolve Cloudflare env ───────────────────────────────────────────────
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as Record<string, string | undefined>;

  // ── Build VAULTCHAIN_LIVE_URL ────────────────────────────────────────────
  const vaultchainLiveUrl = buildVaultchainLiveUrl(
    baseUrl,
    cfEnv.FIREBASE_PROJECT_ID,
  );

  // ── Construct document payload ───────────────────────────────────────────
  const issuedAt = new Date().toISOString();
  const document = {
    // DID-inspired context
    "@context":         ["https://www.w3.org/ns/did/v1", "https://averyos.com/ns/sovereign/v1"],
    id:                 `did:web:${AVERYOS_RELYING_PARTY_ID}`,
    controller:         `did:web:${AVERYOS_RELYING_PARTY_ID}`,
    alsoKnownAs:        [`https://${AVERYOS_RELYING_PARTY_ID}`],

    // JWKS pointer — same key used for OIDC token signing
    verificationMethod: [
      {
        id:                 `did:web:${AVERYOS_RELYING_PARTY_ID}#${KEY_ID}`,
        type:               "JsonWebKey2020",
        controller:         `did:web:${AVERYOS_RELYING_PARTY_ID}`,
        publicKeyJwkUri:    `${baseUrl}/.well-known/jwks.json`,
      },
    ],

    // Cross-cloud sync pointer — the Sovereign Mesh nexus
    vaultchain_live_url:   vaultchainLiveUrl,
    vaultchain_collection: "vaultchain_anchors",
    firebase_project:      cfEnv.FIREBASE_PROJECT_ID ?? "PENDING_CREDENTIALS",

    // Kernel anchor — GATE 118.4: dual-hash (SHA-512 primary + SHA-256 bridge)
    kernel_sha:            KERNEL_SHA,
    kernel_sha256_bridge:  KERNEL_SHA256_BRIDGE,
    kernel_version:        KERNEL_VERSION,
    disclosure_url:        `${baseUrl}${DISCLOSURE_MIRROR_PATH}`,
    sovereign_anchor:      "⛓️⚓⛓️",

    // Issuance metadata
    issued_at:             issuedAt,
    jwks_key_id:           KEY_ID,
  };

  // ── SHA-512 signature over the serialized document ───────────────────────
  // Uses the KERNEL_SHA to anchor the signature to the sovereign root.
  // This is a payload integrity hash, not a full JWS — for full JWS use
  // /.well-known/jwks.json + the token endpoint.
  const documentJson  = JSON.stringify(document);
  const payloadSha    = await sha512hex(`${KERNEL_SHA}:${documentJson}`);

  // ── Optionally attach public JWK for inline verification ────────────────
  let publicJwk: JsonWebKey | null = null;
  try {
    const keyPair = await getSovereignKeys({
      AVERYOS_PRIVATE_KEY_B64:        cfEnv.AVERYOS_PRIVATE_KEY_B64,
      AVERYOS_PUBLIC_KEY_B64:         cfEnv.AVERYOS_PUBLIC_KEY_B64,
      AVERYOS_PRIVATE_KEY_B64_1_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_1_OF_3,
      AVERYOS_PRIVATE_KEY_B64_2_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_2_OF_3,
      AVERYOS_PRIVATE_KEY_B64_3_OF_3: cfEnv.AVERYOS_PRIVATE_KEY_B64_3_OF_3,
    });
    if (keyPair.publicKey) {
      publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    }
  } catch {
    // Key not yet configured — continue without inline JWK
  }

  const signed = {
    ...document,
    proof: {
      type:               "SHA512SignatureProof2026",
      created:            issuedAt,
      verificationMethod: `did:web:${AVERYOS_RELYING_PARTY_ID}#${KEY_ID}`,
      proofPurpose:       "assertionMethod",
      payload_sha512:     payloadSha,
      ...(publicJwk ? { jwk: publicJwk } : {}),
    },
  };

  return new Response(JSON.stringify(signed, null, 2), {
    status: 200,
    headers: {
      "Content-Type":  "application/json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Kernel-SHA":  KERNEL_SHA.slice(0, 16) + "…",
      "X-AOS-Anchor":  "⛓️⚓⛓️",
    },
  });
}
