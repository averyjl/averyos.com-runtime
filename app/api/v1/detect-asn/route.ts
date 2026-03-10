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
