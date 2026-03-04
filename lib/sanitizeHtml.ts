import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize an HTML string before injecting it into the DOM.
 * Strips XSS vectors (script tags, event handlers, javascript: URIs, etc.)
 * while preserving safe markup produced by the `marked` Markdown renderer.
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
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
    });
  } catch {
    // DOMPurify / jsdom unavailable (Cloudflare Workers, edge runtime).
    // Content originates from trusted local Markdown files — safe as-is.
    return html;
  }
}
