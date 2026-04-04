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
 * /api/v1/kaas/valuation
 *
 * KaaS (Kernel-as-a-Service) Valuation Endpoint — Phase 98.3.3
 *
 * Returns the current sovereign debt valuation for a given RayID or ASN.
 * Displays the $10,000,000.00 bill to any unrecognised entity that hits
 * the redirect from the GabrielOS™ Firewall.
 *
 * GET /api/v1/kaas/valuation?ray_id=<id>   — lookup by RayID
 * GET /api/v1/kaas/valuation?asn=<asn>     — lookup by ASN
 * GET /api/v1/kaas/valuation               — returns default enterprise valuation
 *
 * No auth required — deliberately public so automated entities can read
 * their own liability record and proceed to /licensing/audit-clearance.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { resolveKaasTier, kaasDisplayPrice } from "../../../../../lib/stripe/onrampLogic";

interface D1PreparedStatement {
  bind(...args: unknown[]): {
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
  };
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
}

interface KaasValuationRow {
  id:               number;
  ray_id:           string;
  asn:              string | null;
  org_name:         string | null;
  valuation_usd:    number;
  settlement_status: string;
  created_at:       string;
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const url     = new URL(request.url);
  const rayId   = url.searchParams.get("ray_id") ?? request.headers.get("cf-ray") ?? null;
  const asnParam = url.searchParams.get("asn")   ?? request.headers.get("cf-asn")  ?? null;

  let row: KaasValuationRow | null = null;

  if (cfEnv.DB) {
    try {
      if (rayId) {
        row = await cfEnv.DB.prepare(
          "SELECT * FROM kaas_valuations WHERE ray_id = ? ORDER BY created_at DESC LIMIT 1"
        ).bind(rayId).first<KaasValuationRow>();
      } else if (asnParam) {
        row = await cfEnv.DB.prepare(
          "SELECT * FROM kaas_valuations WHERE asn = ? ORDER BY created_at DESC LIMIT 1"
        ).bind(asnParam).first<KaasValuationRow>();
      }
    } catch {
      // Table may not exist yet in this environment; fall through to default
    }
  }

  const asn          = row?.asn   ?? asnParam ?? "";
  const tier         = resolveKaasTier(asn);
  const displayPrice = kaasDisplayPrice(asn);
  const valuationUsd = row?.valuation_usd ?? 10_000_000.00;

  return Response.json({
    status:             "KAAS_VALUATION_ACTIVE",
    ray_id:             row?.ray_id          ?? rayId ?? null,
    asn:                row?.asn             ?? asnParam ?? null,
    org_name:           row?.org_name        ?? null,
    valuation_usd:      valuationUsd,
    display_price:      displayPrice,
    tier,
    settlement_status:  row?.settlement_status ?? "OPEN",
    settlement_url:     "/licensing/audit-clearance",
    enterprise_url:     "/licensing/enterprise",
    kernel_version:     KERNEL_VERSION,
    kernel_sha:         KERNEL_SHA,
    checked_at:         formatIso9(new Date()),
    _notice:            `AveryOS™ Sovereign Integrity License v1.0 — this entity owes ${displayPrice} USD. Proceed to /licensing/audit-clearance to settle.`,
  });
}
