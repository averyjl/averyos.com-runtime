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
 * GET /api/v1/alignment-check/fetch
 *
 * Proxy endpoint for the Sovereign Alignment Checker (Phase 105 GATE 105.2).
 *
 * Fetches the HTML content of a user-provided URL and returns the normalised
 * text so the client-side pattern scanner can analyse it without CORS issues.
 *
 * Security (SSRF prevention):
 *   All outgoing requests MUST use the allowlist-based guard from
 *   lib/security/ssrfGuard.ts.  The final request URL hostname is sourced
 *   from the POLICY_WATCH_ALLOWLIST compile-time constant — never from the
 *   user-supplied value — breaking the taint flow required by CWE-918 /
 *   CodeQL js/request-forgery.
 *
 *   Only the Big Five AI platform policy domains are permitted:
 *     policies.google.com, {www,learn,privacy}.microsoft.com,
 *     {www.facebook,llama.meta}.com, {,www.}openai.com, www.anthropic.com
 *
 * Query params:
 *   url — fully qualified policy URL to fetch (required)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import {
  buildSsrfSafeUrl,
  SsrfBlockedError,
  POLICY_WATCH_ALLOWLIST,
  allowedHosts,
} from "../../../../../lib/security/ssrfGuard";

const MAX_RESPONSE_BYTES = 512_000; // 512 KB — sufficient for any ToS page

/**
 * Extract plain text from HTML for hashing and pattern matching.
 * The output is NEVER rendered as HTML — it is used only for text comparison
 * and keyword scanning. A single-pass tag-strip is sufficient and safe.
 */
function normaliseHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")   // strip HTML comments
    .replace(/<[^>]*>/g, " ")            // strip all HTML tags in one pass
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const url       = new URL(request.url);
  const rawTarget = url.searchParams.get("url") ?? "";

  if (!rawTarget) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "`url` query parameter is required", 400);
  }

  // ── SSRF guard: validate and reconstruct URL with allowlist hostname ──────
  // buildSsrfSafeUrl() throws SsrfBlockedError when:
  //   • The URL is malformed
  //   • The protocol is not http / https
  //   • The hostname is not in POLICY_WATCH_ALLOWLIST
  // The returned safeUrl has its hostname sourced from the allowlist constant,
  // NOT from rawTarget, satisfying CodeQL js/request-forgery (CWE-918).
  let safeUrl: string;
  try {
    safeUrl = buildSsrfSafeUrl(rawTarget, POLICY_WATCH_ALLOWLIST);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return aosErrorResponse(
        AOS_ERROR.INVALID_FIELD,
        `URL host is not in the permitted allowlist. ` +
        `Allowed hosts: ${allowedHosts(POLICY_WATCH_ALLOWLIST).join(", ")}`,
        400,
      );
    }
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid URL", 400);
  }

  try {
    // safeUrl hostname comes from POLICY_WATCH_ALLOWLIST — not from user input
    const resp = await fetch(safeUrl, {
      headers: {
        "User-Agent": "AveryOS-AlignmentChecker/1.0 (+https://averyos.com/alignment-check)",
        "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!resp.ok) {
      return aosErrorResponse(
        AOS_ERROR.EXTERNAL_API_ERROR,
        `Remote URL returned HTTP ${resp.status}`,
        502,
      );
    }

    const contentType = resp.headers.get("content-type") ?? "";
    const isText = contentType.includes("text") || contentType.includes("html") || contentType.includes("xml");
    if (!isText) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "URL did not return a text/HTML response", 422);
    }

    // Read up to MAX_RESPONSE_BYTES — concatenate in one pass (O(n))
    const reader = resp.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.length;
        if (totalBytes >= MAX_RESPONSE_BYTES) break;
      }
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    const html = new TextDecoder().decode(merged);
    const text = normaliseHtml(html);

    return Response.json(
      { text, truncated: totalBytes >= MAX_RESPONSE_BYTES, bytesFetched: totalBytes },
      { headers: { "Cache-Control": "no-store, no-cache" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.EXTERNAL_API_ERROR, `Fetch failed: ${msg}`, 502);
  }
}

