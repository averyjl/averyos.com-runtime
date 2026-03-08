/**
 * Dynamic /.well-known/security.txt handler
 *
 * Serves an RFC 9116-compliant security.txt that auto-updates its Expires
 * field 12 months from the build time.
 *
 * Host-header–aware: includes subdomain-specific metadata when available.
 * Uses lib/sovereignMetadata.ts for shared generation logic so that
 * updates to the policy text propagate automatically to all subdomains.
 *
 * Canonical URL: https://averyos.com/.well-known/security.txt
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { headers } from "next/headers";
import { buildSecurityTxt } from "../../../lib/sovereignMetadata";

export const dynamic = "force-dynamic";

/** Derives the hostname from the request Host header. */
async function getHostname(): Promise<string> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("host") ?? "";
    return host.split(":")[0].toLowerCase();
  } catch {
    return "averyos.com";
  }
}

export async function GET(): Promise<Response> {
  const hostname = await getHostname();
  const content = buildSecurityTxt(hostname);

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-AveryOS-Anchor": "cf83-v3.6.2",
    },
  });
}

