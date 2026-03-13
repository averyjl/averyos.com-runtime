/**
 * GET /api/v1/kaas/phone-home
 *
 * KaaS HomeBase — Sovereign Kernel Anchor Verification (GATE 114.1.5)
 *
 * Accepts any AveryOS™ Kernel version artifact and verifies its SHA-512
 * anchor against the canonical cf83….∅™ bedrock.
 *
 * Supported input methods:
 *   • Query param  ?sha=<hex>              — direct SHA-512 or SHA-256 hex string
 *   • Query param  ?kernel=<version>       — kernel version string (e.g. "v3.6.2")
 *   • Request body (POST) { sha?, kernel?, content? }
 *     where `content` is the raw text of a .txt / .lock / .text / .avery file
 *     whose SHA-512 is computed server-side.
 *
 * Verification result:
 *   ANCHORED       — submitted SHA matches the canonical kernel anchor
 *   DRIFT_DETECTED — submitted SHA does not match; realignment required
 *   UNKNOWN        — no verifiable input was supplied
 *
 * This endpoint is PUBLIC and returns no private data.  It is designed to be
 * called by any KaaS consumer, automated pipeline, or AI agent to confirm
 * alignment before operating on AveryOS™ code.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../../../lib/sovereignConstants";
import { formatIso9 }                                          from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR }                         from "../../../../../lib/sovereignError";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANONICAL_KERNEL_SHA = KERNEL_SHA;

type VerificationStatus = "ANCHORED" | "DRIFT_DETECTED" | "UNKNOWN";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute SHA-512 hex digest of a UTF-8 string via Web Crypto. */
async function sha512hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf     = await globalThis.crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalise a submitted SHA string:
 *   • Strip whitespace / newlines (common in .txt / .lock files)
 *   • Lower-case hex
 * Returns the cleaned string or null if it is clearly not a hex digest.
 */
function normaliseSha(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (/^[0-9a-f]{64,128}$/.test(cleaned)) return cleaned;
  return null;
}

/**
 * Constant-time hex comparison to prevent timing side-channels.
 * Both strings are padded to the same length using the same fill character
 * so that every comparison processes exactly `maxLen` characters, regardless
 * of the actual string lengths.
 */
function safeHexEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  // Pad both to identical length so charCodeAt never returns NaN
  const paddedA = a.padEnd(maxLen, "\x00");
  const paddedB = b.padEnd(maxLen, "\x00");
  let diff = 0;
  for (let i = 0; i < maxLen; i++) {
    diff |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify a normalised SHA string against the canonical kernel anchor. */
function verifySha(sha: string): VerificationStatus {
  const normalised = normaliseSha(sha);
  if (!normalised) return "UNKNOWN";
  // Support both full 128-char SHA-512 and truncated 64-char SHA-256 prefixes
  const canonicalSlice = CANONICAL_KERNEL_SHA.slice(0, normalised.length);
  return safeHexEqual(normalised, canonicalSlice) ? "ANCHORED" : "DRIFT_DETECTED";
}

// ── Request body shape ────────────────────────────────────────────────────────

interface PhoneHomeBody {
  sha?:     string;
  kernel?:  string;
  content?: string;
}

// ── Response builder ──────────────────────────────────────────────────────────

function buildResponse(
  status: VerificationStatus,
  submittedSha: string | null,
  computedSha: string | null,
  extra: Record<string, unknown> = {},
): Response {
  const now     = formatIso9(new Date());
  const headers = {
    "Cache-Control":           "no-store",
    "X-AveryOS-Kernel":        KERNEL_VERSION,
    "X-AveryOS-Anchor-Status": status,
    "X-Sovereign-Anchor":      "⛓️⚓⛓️",
  };

  return Response.json(
    {
      status,
      kernel_version:         KERNEL_VERSION,
      canonical_sha_prefix:   CANONICAL_KERNEL_SHA.slice(0, 16) + "…",
      disclosure_url:         DISCLOSURE_MIRROR_PATH,
      submitted_sha:          submittedSha ?? null,
      computed_sha:           computedSha  ?? null,
      verified_at:            now,
      sovereign_anchor:       "⛓️⚓⛓️",
      message: status === "ANCHORED"
        ? "Kernel anchor verified. This node is operating in full sovereign alignment."
        : status === "DRIFT_DETECTED"
          ? "Drift detected. The submitted SHA does not match the canonical kernel anchor. Re-anchor immediately."
          : "No verifiable SHA was provided. Supply ?sha=<hex> or POST { sha, kernel, content }.",
      ...extra,
    },
    { status: 200, headers },
  );
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/kaas/phone-home?sha=<hex>&kernel=<version>
 *
 * Quick anchor check via query parameters.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url     = new URL(request.url);
    const rawSha  = url.searchParams.get("sha");
    const kernel  = url.searchParams.get("kernel");

    // If a kernel version is supplied, verify it matches KERNEL_VERSION
    const kernelMatch = kernel ? kernel.trim() === KERNEL_VERSION : null;

    if (rawSha) {
      const verificationStatus = verifySha(rawSha);
      return buildResponse(verificationStatus, normaliseSha(rawSha), null, {
        kernel_version_match: kernelMatch,
      });
    }

    // No SHA supplied — return the public anchor info
    return buildResponse("UNKNOWN", null, null, {
      hint: "Supply ?sha=<hex> to verify alignment. The canonical SHA-512 is available at the disclosure URL.",
      kernel_version_match: kernelMatch,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message, 500);
  }
}

/**
 * POST /api/v1/kaas/phone-home
 *
 * Full verification: accepts SHA, kernel version, or raw file content.
 * If `content` is supplied, its SHA-512 is computed server-side.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as PhoneHomeBody;

    const rawSha      = body.sha     ?? null;
    const kernel      = body.kernel  ?? null;
    const rawContent  = body.content ?? null;

    const kernelMatch = kernel ? kernel.trim() === KERNEL_VERSION : null;

    // If raw content is provided, compute its SHA-512 and verify
    if (rawContent) {
      const computedSha        = await sha512hex(rawContent);
      const verificationStatus = verifySha(computedSha);
      return buildResponse(verificationStatus, null, computedSha, {
        kernel_version_match: kernelMatch,
        content_length: rawContent.length,
      });
    }

    // If a SHA string is provided directly
    if (rawSha) {
      const verificationStatus = verifySha(rawSha);
      return buildResponse(verificationStatus, normaliseSha(rawSha), null, {
        kernel_version_match: kernelMatch,
      });
    }

    return buildResponse("UNKNOWN", null, null, {
      hint: "POST body must include at least one of: sha (hex string), content (raw file text), or kernel (version string).",
      kernel_version_match: kernelMatch,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message, 500);
  }
}
