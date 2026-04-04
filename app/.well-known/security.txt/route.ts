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

