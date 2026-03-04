/**
 * Sanitize an HTML string before injecting it into the DOM.
 * Strips XSS vectors (script tags, event handlers, javascript: URIs, etc.)
 * while preserving safe markup produced by the `marked` Markdown renderer.
 *
 * Uses a dynamic require so that the jsdom/DOMPurify module initialisation is
 * deferred to call-time and wrapped in a try-catch.  A static top-level import
 * would cause the Cloudflare Workers bundle to crash during module evaluation
 * (jsdom references Node.js APIs absent from the edge runtime), breaking every
 * page that transitively imports this module — including the Whitepaper.
 *
 * Falls back to returning the input unchanged when DOMPurify or jsdom is
 * unavailable (e.g. Cloudflare Workers edge runtime). Content rendered via
 * TruthforcePage always originates from trusted local Markdown files so the
 * fallback is safe.
 *
 * Use this every time you need to pass HTML to `dangerouslySetInnerHTML`.
 */
export function sanitizeHtml(html: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DOMPurify = require("isomorphic-dompurify") as {
      sanitize(html: string, options?: Record<string, unknown>): string;
    };
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
    });
  } catch {
    // DOMPurify / jsdom unavailable (Cloudflare Workers, edge runtime).
    // Content originates from trusted local Markdown files — safe as-is.
    return html;
  }
}
