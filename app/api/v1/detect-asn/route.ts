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
 * GET /api/v1/detect-asn
 *
 * Returns the requesting entity's ASN, IP address, and country code
 * as detected from Cloudflare edge headers.
 *
 * Used by:
 *   • app/licensing/agentic/page.tsx — pre-populate checkout with entity tier
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { type NextRequest } from "next/server";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { formatIso9 } from "../../../../lib/timePrecision";

export async function GET(request: NextRequest) {
  try {
    const asn     = request.headers.get("cf-asn")        ?? null;
    const country = request.headers.get("cf-ipcountry")  ?? null;
    const ip      =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      null;

    return Response.json(
      {
        asn,
        country,
        ip,
        detectedAt: formatIso9(),
      },
      { headers: { "Cache-Control": "no-store, no-cache" } },
    );
  } catch {
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, "ASN detection failed", 500);
  }
}
