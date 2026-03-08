/**
 * Sovereign Sitemap Route Handler
 *
 * Serves the pre-generated sitemap.xml with the correct Content-Type.
 * Using a Route Handler (instead of a static public/ file) ensures the
 * Cloudflare ASSETS binding does NOT take priority over the Worker script
 * for .xml extensions — the common cause of sitemap 404s on Cloudflare Workers.
 *
 * The sitemap is rebuilt on every `npm run build:cloudflare` run via
 * `scripts/capsuleSitemap.cjs`. The route reads the pre-built file from
 * public/sitemap.xml at build time (force-static) so it is available
 * in the Cloudflare Worker without requiring a Node.js filesystem call
 * at request time.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-static";

// Read the pre-generated sitemap at build time.
// capsuleSitemap.cjs writes this file during npm run capsule:sitemap.
let sitemapContent: string;
try {
  sitemapContent = readFileSync(join(process.cwd(), "public", "sitemap.xml"), "utf-8");
} catch {
  // Fallback: minimal valid sitemap if the file hasn't been generated yet
  sitemapContent =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>https://averyos.com</loc></url>' +
    '</urlset>';
}

export async function GET(): Promise<Response> {
  return new Response(sitemapContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-AveryOS-Anchor": "cf83-v3.6.2",
    },
  });
}
