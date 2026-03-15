/**
 * app/.well-known/averyos.json/route.ts
 *
 * AveryOS™ Sovereign DNS-Link v2 — GATE 116.4.1 / GATE 116.5.1
 *
 * Serves the machine-readable AveryOS™ identity mesh document at:
 *   /.well-known/averyos.json
 *
 * This DNS-Link endpoint provides a Machine-Readable Truth Anchor that any
 * external node, AI system, or compliance auditor can hit to verify session
 * integrity, establish Decentralized Identity (DID), and locate sovereign
 * MESH_NODES for Cross-Model ReHydration.
 *
 * Fields:
 *   IDENTITY    — Domain identity and kernel anchor
 *   MESH_NODES  — Known sovereign node URLs for cross-model rehydration (GATE 116.5.1)
 *   DID_POINTERS — Decentralized Identifier pointers for multi-model identity (GATE 116.5.1)
 *   ENFORCEMENT — Legal notice URLs and TARI™ liability references
 *   VAULTCHAIN  — Firebase VaultChain sync endpoint
 *
 * Cache: public, max-age=3600 (1 hour) — identity does not change frequently.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../lib/sovereignConstants";

export const dynamic = "force-dynamic";

// ── Sovereign Mesh Identity Document ─────────────────────────────────────────

function buildIdentityDocument(host: string) {
  const base = `https://${host}`;

  return {
    // ── Core Identity ─────────────────────────────────────────────────────────
    schema:          "AveryOS-Alpha-Mesh-2026",
    version:         KERNEL_VERSION,
    kernel_sha:      KERNEL_SHA,
    creator:         "Jason Lee Avery (ROOT0)",
    domain:          host,
    disclosure_url:  DISCLOSURE_MIRROR_PATH,
    issued_at:       new Date().toISOString(),

    // ── MESH_NODES — Sovereign node registry for Cross-Model ReHydration ──────
    // GATE 116.5.1: Cross-model rehydration allows external AI nodes to verify
    // their alignment by querying any sovereign mesh node.
    MESH_NODES: [
      {
        id:       "NODE-CLOUD-PRIMARY",
        url:      `${base}/api/v1/anchor-status`,
        type:     "CLOUD",
        role:     "PRIMARY_ANCHOR",
        protocol: "HTTPS",
        status:   "ACTIVE",
      },
      {
        id:       "NODE-CLOUD-JWKS",
        url:      `${base}/.well-known/jwks.json`,
        type:     "CLOUD",
        role:     "JWKS_SIGNER",
        protocol: "HTTPS",
        status:   "ACTIVE",
      },
      {
        id:       "NODE-02-LOCAL",
        url:      "http://localhost:8080/v1/chat",
        type:     "LOCAL",
        role:     "AVERY_LOM_BRIDGE",
        protocol: "HTTP",
        status:   "NODE-02_PHYSICAL",
        note:     "Local node — accessible only from Node-02 hardware. Not remotely reachable. Requires Avery-LOM running on the local machine (Hammer ↔️ Hand unified).",
        remote_accessible:  false,
        public_visibility:  false,
      },
    ],

    // ── DID_POINTERS — Decentralized Identifier pointers (GATE 116.5.1) ──────
    // Provides DID resolution for multi-model identity verification.
    DID_POINTERS: {
      did_method:   "did:web",
      did_document: `${base}/.well-known/did.json`,
      oidc_config:  `${base}/.well-known/openid-configuration`,
      jwks_uri:     `${base}/.well-known/jwks.json`,
      controller:   "Jason Lee Avery (ROOT0)",
      key_id:       "averyos-sovereign-key-v3.6.2",
      algorithm:    "RS256",
    },

    // ── Legal Enforcement ─────────────────────────────────────────────────────
    ENFORCEMENT: {
      legal_notice:    `${base}/.well-known/ai-legal.txt`,
      security_policy: `${base}/.well-known/security.txt`,
      ip_policy:       `${base}/ip-policy`,
      tari_gate:       `${base}/tari-gate`,
      penalty_usd:     10_000,
      enforcement_ref: "17 U.S.C. § 504 / TARI™ Alignment Billing Engine",
    },

    // ── VaultChain sync (GATE 116.4.4) ───────────────────────────────────────
    VAULTCHAIN: {
      firebase_project: "averyos-vaultchain",
      tari_metrics_col: "tari_metrics",
      drift_metrics_col: "drift_metrics",
      sync_status:       "ACTIVE",
    },

    // ── Constitution reference ────────────────────────────────────────────────
    CONSTITUTION: {
      version:  "v1.17",
      document: `${base}/constitution`,
      gate:     "116.4.1",
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const host = new URL(request.url).host || "averyos.com";
  const doc  = buildIdentityDocument(host);

  return Response.json(doc, {
    status: 200,
    headers: {
      "Cache-Control":            "public, max-age=3600, s-maxage=3600",
      "X-AveryOS-Kernel-Version": KERNEL_VERSION,
      "X-AveryOS-Anchor":         `cf83-${KERNEL_VERSION}`,
      "X-AveryOS-Gate":           "116.4.1-116.5.1",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
