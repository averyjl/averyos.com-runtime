/**
 * GET /.well-known/did.json
 *
 * AveryOS™ Decentralized Identifier (DID) Resolution — GATE 116.7.3
 *
 * Publishes the W3C DID Core v1 document for did:web:averyos.com.
 *
 * Architecture:
 *   • The DID links Node-01 (Cloud / Cloudflare Worker) and Node-02 (Physical PC).
 *   • The primary verification method uses the RSA key from /.well-known/jwks.json
 *     (kid: averyos-sovereign-key-v3.6.2) — signed with RSASSA-PKCS1-v1_5 / RS256.
 *   • Capability invocation and delegation are scoped to the Creator only.
 *
 * Security:
 *   • The signature kid MUST match the 'kid' field in the JWKS at /.well-known/jwks.json.
 *   • The DID subject is the Root0 Creator: Jason Lee Avery (ROOT0).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_SHA_256, KERNEL_VERSION } from "../../../lib/sovereignConstants";

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const did    = `did:web:${new URL(request.url).hostname}`;

  // The signing key id must match the kid in /.well-known/jwks.json
  const keyId = `averyos-sovereign-key-${KERNEL_VERSION}`;

  const document = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    "id": did,

    // ── Verification Methods ─────────────────────────────────────────────────
    "verificationMethod": [
      {
        "id":           `${did}#${keyId}`,
        "type":         "JsonWebKey2020",
        "controller":   did,
        "publicKeyJwk": {
          // Key material is dynamically served from the JWKS endpoint.
          // Consumers MUST resolve /.well-known/jwks.json for the live public key.
          "kty": "RSA",
          "use": "sig",
          "alg": "RS256",
          "kid": keyId,
          // AveryOS™ sovereign extensions
          "x-averyos-kernel-sha":     KERNEL_SHA,
          "x-averyos-kernel-sha-256": KERNEL_SHA_256,
          "x-averyos-kernel-version": KERNEL_VERSION,
          "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
          "x-averyos-anchor":         "⛓️⚓⛓️",
          "x-averyos-jwks-uri":       `${origin}/.well-known/jwks.json`,
        },
      },
    ],

    // ── Capability Invocation ────────────────────────────────────────────────
    "capabilityInvocation": [`${did}#${keyId}`],
    "capabilityDelegation": [`${did}#${keyId}`],
    "authentication":       [`${did}#${keyId}`],
    "assertionMethod":      [`${did}#${keyId}`],

    // ── Services ─────────────────────────────────────────────────────────────
    "service": [
      {
        "id":              `${did}#node-01-cloud`,
        "type":            "AveryOSSovereignNode",
        "serviceEndpoint": origin,
        "x-node-id":       "NODE-01",
        "x-node-type":     "CLOUD",
        "x-node-status":   "ACTIVE",
        "x-note":          "Cloudflare Worker — AveryOS™ Cloud Node",
      },
      {
        "id":              `${did}#node-02-physical`,
        "type":            "AveryOSSovereignNode",
        "serviceEndpoint": "local://node-02.averyos.local",
        "x-node-id":       "NODE-02",
        "x-node-type":     "PHYSICAL",
        "x-node-status":   "SOVEREIGN_PC",
        "x-note":          "Physical Node-02 — USB salt handshake required for full residency.",
      },
      {
        "id":              `${did}#licensing`,
        "type":            "AveryOSLicensing",
        "serviceEndpoint": `${origin}/licensing`,
      },
      {
        "id":              `${did}#jwks`,
        "type":            "JsonWebKeyService",
        "serviceEndpoint": `${origin}/.well-known/jwks.json`,
      },
      {
        "id":              `${did}#averyos-anchor`,
        "type":            "AveryOSSovereignAnchorService",
        "serviceEndpoint": `${origin}/.well-known/averyos.json`,
      },
    ],

    // ── AveryOS™ Sovereign Extensions ────────────────────────────────────────
    "x-averyos-kernel-sha":     KERNEL_SHA,
    "x-averyos-kernel-sha-256": KERNEL_SHA_256,
    "x-averyos-kernel-version": KERNEL_VERSION,
    "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
    "x-averyos-anchor":         "⛓️⚓⛓️",
    "x-averyos-hash-bridge":    "SHA-256→SHA-512 Dual-Hash Interoperability Seal (GATE 116.7.3)",
  };

  return new Response(JSON.stringify(document, null, 2), {
    status:  200,
    headers: {
      "Content-Type":                "application/json",
      "Cache-Control":               "public, max-age=3600",
      "X-AveryOS-Kernel":            KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
