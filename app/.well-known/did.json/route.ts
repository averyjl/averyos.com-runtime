/**
 * GET /.well-known/did.json
 *
 * DNS-Link DID (Decentralized Identifier) Resolution Document — GATE 117.4
 *
 * Serves a W3C DID Core-compliant DID document for the AveryOS™ Sovereign
 * Mesh. The DID subject is `did:web:averyos.com`, linking the Sovereign Kernel
 * anchor, JWKS signing key, and multi-node sovereign mesh to a resolvable
 * on-chain identity document.
 *
 * Consumption:
 *   • DID resolvers (did:web method) — resolve did:web:averyos.com
 *   • VaultChain™ Explorer — verify sovereign node identities
 *   • Enterprise MDM / OIDC consumers — cross-reference with JWKS and OIDC
 *     discovery documents already served from /.well-known/
 *
 * References:
 *   • W3C DID Core 1.0 — https://www.w3.org/TR/did-core/
 *   • did:web Method — https://w3c-ccg.github.io/did-method-web/
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../lib/sovereignConstants";
import { NODE_01_ID, NODE_02_ID } from "../../../lib/sovereignNodes";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const baseUrl = new URL(request.url).origin;
  const did     = `did:web:averyos.com`;

  const document = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    id: did,
    controller: did,

    // ── Verification Methods ──────────────────────────────────────────────────
    verificationMethod: [
      {
        id:           `${did}#sovereign-key-${KERNEL_VERSION}`,
        type:         "JsonWebKey2020",
        controller:   did,
        publicKeyJwk: {
          // JWK endpoint is the authoritative source for key material
          "x-averyos-jwks-uri":   `${baseUrl}/.well-known/jwks.json`,
          "x-averyos-kernel-sha": KERNEL_SHA,
        },
      },
      // ── SHA-256 Genesis Bridge — GATE 119.8.3 ──────────────────────────────
      // Legacy SHA-256 public key for cross-system verification.
      // The e9a3 genesis anchor bridges legacy (256-bit) systems to the
      // current SHA-512 Root0 standard, allowing older verifiers to confirm
      // the root anchor without requiring SHA-512 support.
      {
        id:         `${did}#genesis-bridge-sha256`,
        type:       "Sha256GenesisBridge2026",
        controller: did,
        publicKeyJwk: {
          kty:                     "OKP",
          crv:                     "X25519",
          use:                     "enc",
          "x-averyos-genesis-sha256":
            "e9a3cbcd8a0f4f58b1b3f3f0c5a8e1d7b2c9f4e6a0d3b7c1e5f8a2d4c6b9e3f0",
          "x-averyos-bridge-note":
            "SHA-256 genesis seed established at Root0 inception (May 2025). " +
            "Bridges legacy 256-bit verifiers to the SHA-512 Kernel standard.",
          "x-averyos-kernel-sha":  KERNEL_SHA,
        },
      },
    ],

    // ── Capability Invocation & Delegation ────────────────────────────────────
    capabilityInvocation: [`${did}#sovereign-key-${KERNEL_VERSION}`],
    capabilityDelegation: [`${did}#sovereign-key-${KERNEL_VERSION}`],
    assertionMethod:      [`${did}#sovereign-key-${KERNEL_VERSION}`, `${did}#genesis-bridge-sha256`],
    authentication:       [`${did}#sovereign-key-${KERNEL_VERSION}`],

    // ── Service Endpoints ─────────────────────────────────────────────────────
    service: [
      {
        id:              `${did}#licensing`,
        type:            "AveryOSSovereignLicensing",
        serviceEndpoint: `${baseUrl}/licensing`,
        description:     "AveryOS™ Sovereign Licensing & TARI™ Alignment Portal",
      },
      {
        id:              `${did}#vaultchain-explorer`,
        type:            "VaultChainExplorer",
        serviceEndpoint: `${baseUrl}/vaultchain-explorer`,
        description:     "VaultChain™ Hash & RayID Evidence Verification Explorer",
      },
      {
        id:              `${did}#oidc-discovery`,
        type:            "OpenIdConnectVersion1.0Service",
        serviceEndpoint: `${baseUrl}/.well-known/openid-configuration`,
        description:     "OIDC Discovery Document — Enterprise MDM enrollment",
      },
      {
        id:              `${did}#disclosure`,
        type:            "SovereignDisclosure",
        serviceEndpoint: DISCLOSURE_MIRROR_PATH,
        description:     "AveryOS™ Kernel Disclosure — SHA-512 Root0 parity proof",
      },
      {
        id:              `${did}#node-01`,
        type:            "SovereignNode",
        serviceEndpoint: `${baseUrl}/api/v1/health`,
        description:     `Sovereign Node 01 (${NODE_01_ID}) — Phone / mobile edge node`,
      },
      {
        id:              `${did}#node-02`,
        type:            "SovereignNode",
        serviceEndpoint: `${baseUrl}/api/v1/health`,
        description:     `Sovereign Node 02 (${NODE_02_ID}) — PC / ALM (Ollama) node`,
      },
    ],

    // ── AveryOS™ Sovereign Extensions ────────────────────────────────────────
    "x-averyos-kernel-version": KERNEL_VERSION,
    "x-averyos-kernel-sha":     KERNEL_SHA,
    "x-averyos-creator":        "Jason Lee Avery (ROOT0) 🤛🏻",
    "x-averyos-anchor":         "⛓️⚓⛓️",
    "x-averyos-skc-version":    "SKC-2026.1",
  };

  return new Response(JSON.stringify(document, null, 2), {
    status: 200,
    headers: {
      "Content-Type":                "application/json",
      "Cache-Control":               "public, max-age=3600",
      "X-AveryOS-Kernel":            KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
