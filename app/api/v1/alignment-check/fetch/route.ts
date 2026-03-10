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

// Basic SSRF mitigation: block localhost and private IP ranges.
// This intentionally does not depend on any external libraries so it works
// in edge runtimes like Cloudflare Workers.
function isPrivateOrLocalIp(hostname: string): boolean {
  // IPv6 loopback
  if (hostname === "::1") return true;
  // Ignore obvious non-IP hostnames
  const ipv4Parts = hostname.split(".");
  if (ipv4Parts.length === 4 && ipv4Parts.every(p => /^\d+$/.test(p))) {
    const [aStr, bStr, cStr, dStr] = ipv4Parts;
    const a = Number(aStr), b = Number(bStr), c = Number(cStr), d = Number(dStr);
    if ([a, b, c, d].some(n => n < 0 || n > 255 || !Number.isInteger(n))) {
      return false;
    }
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 10.0.0.0/8 private
    if (a === 10) return true;
    // 172.16.0.0/12 private (172.16.0.0 – 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 private
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 link-local
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 "this" network
    if (a === 0) return true;
    // 255.255.255.255 broadcast and other reserved ranges
    if (a === 255) return true;
  }
  // Very small IPv6 check: treat anything starting with "fe80:" (link-local),
  // "fc00:" / "fd00:" (unique local), or "::" (loopback/unspecified) as blocked.
  const lower = hostname.toLowerCase();
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc00:") || lower.startsWith("fd00:")) return true;
  if (lower === "::" || lower === "::1") return true;
  return false;
}

function isBlockedHostname(targetUrl: URL): boolean {
  const hostname = targetUrl.hostname.toLowerCase();
  // Block localhost-style names
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local")) return true;
  // Block raw IPs in private/loopback/link-local ranges
  if (isPrivateOrLocalIp(hostname)) return true;
  return false;
}

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

  if (isBlockedHostname(targetUrl)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "URL host is not allowed",
      400,
    );
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
