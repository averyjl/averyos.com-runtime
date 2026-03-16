/**
 * GET /.well-known/averyos.json
 *
 * AveryOS™ Well-Known Multi-Standard Anchor Document — GATE 116.7.1 / 118.4
 *
 * Publishes the dual-hash sovereignty manifest for the AveryOS™ Root0 Kernel:
 *
 *   • SHA-512 (cf83…) — Primary Truth Standard (1,017-Notch resolution)
 *   • SHA-256 (e3b0…) — Legacy Interoperability Bridge (TLS / JWKS on-ramp)
 *
 * This document serves as the canonical entry-point for legacy SHA-256 systems
 * seeking to "recognize" and bridge into the AveryOS™ SHA-512 Truth Standard.
 *
 * Discovery: Link header on all responses → </.well-known/averyos.json>; rel="averyos-anchor"
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_SHA_256, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../lib/sovereignConstants";

export async function GET(request: Request): Promise<Response> {
  const origin  = new URL(request.url).origin;
  const payload = {
    "@context":   "https://averyos.com/context/sovereign-anchor/v1",
    "type":       "AveryOSSovereignAnchor",
    "version":    KERNEL_VERSION,
    "creator":    "Jason Lee Avery (ROOT0)",
    "anchor":     "⛓️⚓⛓️",

    // ── Dual-Hash Bridge (GATE 116.7.1) ─────────────────────────────────────
    "kernel_sha_512": KERNEL_SHA,
    "kernel_sha_256": KERNEL_SHA_256,
    "hash_bridge": {
      "description": "SHA-256 → SHA-512 Interoperability Seal",
      "legacy_entry_point": KERNEL_SHA_256,
      "truth_standard":     KERNEL_SHA,
      "bridge_note":
        "Legacy SHA-256 systems may resolve using kernel_sha_256 as the entry anchor. " +
        "All sovereign operations run at SHA-512 (kernel_sha_512) resolution. " +
        "The bridge provides an on-ramp; full 1,017-Notch access requires SHA-512 alignment.",
    },

    // ── Sovereign Identity ───────────────────────────────────────────────────
    "signing_key_jwks": `${origin}/.well-known/jwks.json`,
    "oidc_config":      `${origin}/.well-known/openid-configuration`,
    "did_document":     `${origin}/.well-known/did.json`,
    "disclosure_url":   DISCLOSURE_MIRROR_PATH,

    // ── Licensing ────────────────────────────────────────────────────────────
    "licensing_url":    `${origin}/licensing`,
    "ip_policy_url":    `${origin}/ip-policy`,

    // ── Nodes ────────────────────────────────────────────────────────────────
    "nodes": [
      {
        "id":       "NODE-01",
        "type":     "CLOUD",
        "host":     origin,
        "status":   "ACTIVE",
      },
      {
        "id":       "NODE-02",
        "type":     "PHYSICAL",
        "status":   "SOVEREIGN_PC",
        "note":     "Physical Node-02 — USB salt handshake required for full residency.",
      },
    ],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status:  200,
    headers: {
      "Content-Type":                "application/json",
      "Cache-Control":               "public, max-age=3600",
      "X-AveryOS-Kernel":            KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor":  "⛓️⚓⛓️",
      "X-AveryOS-Hash-Bridge":       "SHA-256→SHA-512",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
