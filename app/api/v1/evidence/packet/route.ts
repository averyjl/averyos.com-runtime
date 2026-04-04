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
 * POST /api/v1/evidence/packet
 *
 * VaultChain™ Evidence Packet Generator — Phase 107.1 (Gate 6)
 *
 * Wires buildEvidencePacket() from lib/forensics/globalVault.ts into a
 * public API endpoint so the VaultChain™ Explorer can generate and download
 * a multi-jurisdictional International Evidence Packet from the client.
 *
 * Request body:
 *   {
 *     ray_id?:          string,
 *     ip_address?:      string,
 *     asn?:             string,
 *     country_code?:    string,
 *     org_name?:        string,
 *     path?:            string,
 *     ingestion_intent?: string,
 *     tier?:            number,
 *     valuation_cents?: number,
 *   }
 *
 * Returns:
 *   EvidencePacket JSON — fully serializable, suitable for PDF/DOCX bundling.
 *
 * No auth required — packet contents are generated from caller-supplied inputs.
 * No private data is included; IP/ASN are echoed back from the request body.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { buildEvidencePacket } from "../../../../../lib/forensics/globalVault";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const rayId           = typeof body.ray_id          === "string" ? body.ray_id          : (request.headers.get("cf-ray") ?? "UNKNOWN");
  const ipAddress       = typeof body.ip_address      === "string" ? body.ip_address      : (request.headers.get("cf-connecting-ip") ?? "UNKNOWN");
  const asn             = typeof body.asn             === "string" ? body.asn             : (request.headers.get("cf-asn") ?? "UNKNOWN");
  const countryCode     = typeof body.country_code    === "string" ? body.country_code    : (request.headers.get("cf-ipcountry") ?? "US");
  const orgName         = typeof body.org_name        === "string" ? body.org_name        : undefined;
  const path            = typeof body.path            === "string" ? body.path            : "/vaultchain-explorer";
  const ingestionIntent = typeof body.ingestion_intent === "string" ? body.ingestion_intent : "VAULTCHAIN_EXPLORER";
  const tier            = typeof body.tier            === "number"  ? body.tier            : 1;
  const valuationCents  = typeof body.valuation_cents === "number"  ? body.valuation_cents : 101_700;

  const packet = buildEvidencePacket({
    ray_id:           rayId,
    asn,
    ip_address:       ipAddress,
    country_code:     countryCode,
    org_name:         orgName,
    ingestion_intent: ingestionIntent,
    tier,
    valuation_cents:  valuationCents,
    notes:            path,
  });

  return Response.json(packet, {
    headers: {
      "Content-Type": "application/json",
      "X-AveryOS-Anchor": "cf83-v3.6.2",
    },
  });
}
