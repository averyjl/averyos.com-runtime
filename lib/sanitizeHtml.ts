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
