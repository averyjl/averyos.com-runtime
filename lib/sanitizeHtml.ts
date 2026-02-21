import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize an HTML string before injecting it into the DOM.
 * Strips XSS vectors (script tags, event handlers, javascript: URIs, etc.)
 * while preserving safe markup produced by the `marked` Markdown renderer.
 *
 * Use this every time you need to pass HTML to `dangerouslySetInnerHTML`.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}
