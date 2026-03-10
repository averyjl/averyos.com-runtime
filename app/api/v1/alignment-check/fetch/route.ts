/**
 * GET /api/v1/alignment-check/fetch
 *
 * Proxy endpoint for the Sovereign Alignment Checker (Phase 105 GATE 105.2).
 *
 * Fetches the HTML content of a user-provided URL and returns the normalised
 * text so the client-side pattern scanner can analyse it without CORS issues.
 *
 * Security: URL is validated to be http/https only. No private IP ranges
 * are reachable from Cloudflare Workers so SSRF risk is minimal.
 *
 * Query params:
 *   url — fully qualified URL to fetch (required)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

const MAX_RESPONSE_BYTES = 512_000; // 512 KB — sufficient for any ToS page

/**
 * Extract plain text from HTML for hashing and pattern matching.
 * The output is NEVER rendered as HTML — it is used only for SHA-256 comparison
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
  const url = new URL(request.url);
  const rawTarget = url.searchParams.get("url") ?? "";

  if (!rawTarget) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "`url` query parameter is required", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawTarget);
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid URL format", 400);
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Only http/https URLs are supported", 400);
  }

  try {
    const resp = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "AveryOS-AlignmentChecker/1.0 (+https://averyos.com/alignment-check)",
        "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      // Cloudflare fetch timeout is 30s by default
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

    // Read up to MAX_RESPONSE_BYTES to avoid memory issues
    const reader     = resp.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes   = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.length;
        if (totalBytes >= MAX_RESPONSE_BYTES) break;
      }
    }

    // Concatenate all chunks into a single buffer in one pass
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    const html  = new TextDecoder().decode(merged);
    const text  = normaliseHtml(html);

    return Response.json(
      { text, truncated: totalBytes >= MAX_RESPONSE_BYTES, bytesFetched: totalBytes },
      { headers: { "Cache-Control": "no-store, no-cache" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.EXTERNAL_API_ERROR, `Fetch failed: ${msg}`, 502);
  }
}
