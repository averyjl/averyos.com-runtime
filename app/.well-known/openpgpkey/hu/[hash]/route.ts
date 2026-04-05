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
 * GET /.well-known/openpgpkey/hu/[hash]
 *
 * RFC 7929 — Web Key Directory (WKD) for automatic email client key discovery.
 *
 * This endpoint allows email clients (Thunderbird, K-9, ProtonMail Bridge,
 * GPG Suite, etc.) to automatically retrieve the public OpenPGP key for any
 * @averyos.com or @averyworld.com address.
 *
 * URL structure (WKD direct method):
 *   GET /.well-known/openpgpkey/hu/{zbase32-sha1-localpart}?l={localpart}
 *
 * {hash}     — Z-Base-32 encoded SHA-1 hash of the lowercase email local-part.
 * ?l=        — Optional: email local-part for advanced method lookup.
 *
 * Key storage:
 *   Keys are stored in Cloudflare KV (AVERY_KV) under the key:
 *     `openpgp:hu:{hash}`
 *   The value is the binary OpenPGP key in transferable format.
 *
 *   To upload a key:
 *     wrangler kv:key put --binding AVERY_KV "openpgp:hu:{hash}" --path pubkey.gpg
 *
 * Response:
 *   200 — application/octet-stream binary OpenPGP key data
 *   404 — no key found for this hash
 *   400 — hash format invalid
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";

// ── Minimal KV binding type ───────────────────────────────────────────────────

interface KVNamespace {
  get(key: string, options: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>;
  get(key: string): Promise<string | null>;
}

interface CloudflareEnv {
  AVERY_KV?: KVNamespace;
}

// ── Route parameters ──────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ hash: string }>;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Z-Base-32 alphabet (RFC 6189 / Zooko's base32).
 * WKD hashes use this encoding — NOT standard Base32.
 */
const ZBASE32_PATTERN = /^[ybndrfg8ejkmcpqxot1uwisza345h769]{32}$/i;

function isValidWkdHash(hash: string): boolean {
  return ZBASE32_PATTERN.test(hash);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  // ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
  const { hash } = await params;

  // Validate Z-Base-32 hash format (always 32 chars for SHA-1 digest)
  if (!hash || !isValidWkdHash(hash)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "WKD hash must be a 32-character Z-Base-32 string (SHA-1 of lowercase email local-part).",
      400,
    );
  }

  // Retrieve Cloudflare KV binding
  let cfEnv: CloudflareEnv = {};
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    // Non-Cloudflare environment (local dev) — return 404 gracefully
    return new Response(null, {
      status: 404,
      headers: {
        "X-AveryOS-Kernel": KERNEL_SHA.slice(0, 16),
        "X-AveryOS-Version": KERNEL_VERSION,
      },
    });
  }

  if (!cfEnv.AVERY_KV) {
    return aosErrorResponse(
      AOS_ERROR.DB_UNAVAILABLE,
      "Key directory not configured.",
      503,
    );
  }

  // Fetch the binary OpenPGP key from KV
  const kvKey = `openpgp:hu:${hash.toLowerCase()}`;
  let keyBuffer: ArrayBuffer | null = null;
  try {
    keyBuffer = await cfEnv.AVERY_KV.get(kvKey, { type: "arrayBuffer" });
  } catch {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      "Key lookup failed.",
      500,
    );
  }

  if (!keyBuffer) {
    // RFC 7929 §4.2 — return 404 when no key is found
    return new Response(null, {
      status: 404,
      headers: {
        "X-AveryOS-Kernel": KERNEL_SHA.slice(0, 16),
        "X-AveryOS-Version": KERNEL_VERSION,
      },
    });
  }

  // Return binary key with correct RFC 7929 content type
  return new Response(keyBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      // Cache for 1 hour — keys change infrequently
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-AveryOS-Kernel": KERNEL_SHA.slice(0, 16),
      "X-AveryOS-Version": KERNEL_VERSION,
      // CORS: email clients may fetch from different origins
      "Access-Control-Allow-Origin": "*",
    },
  });
}
