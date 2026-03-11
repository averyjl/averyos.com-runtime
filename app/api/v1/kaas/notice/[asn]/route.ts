/**
 * GET /api/v1/kaas/notice/[asn]
 *
 * Jurisdictional Notice Generator — AveryOS™ Phase 106 / Roadmap Gate 2.4
 *
 * Generates a multi-jurisdictional Notice of Violation (NOV) for a given ASN.
 * Uses getStatutoryOrigin() equivalent (resolveJurisdiction from globalVault.ts)
 * alongside JURISDICTION_STATUTES to produce jurisdiction-aware NOVs.
 *
 * Supports multi-language statutory frameworks:
 *   US  — 17 U.S.C. § 504(c)(2) + § 1201 (DMCA)
 *   EU  — EU AI Act Art. 53(1)(c) + CDSM Directive
 *   UK  — CDPA 1988 §§ 22–23
 *   JP  — Copyright Act Art. 30-4
 *
 * Query params:
 *   country_code   — optional ISO-3166 code to force a specific jurisdiction
 *   ip_address     — optional IP for evidence metadata
 *   org_name       — optional organization name
 *   format         — "json" (default) | "text" (plain text NOV)
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }        from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION }  from "../../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../../lib/sovereignError";
import {
  getAsnTier,
  getAsnFeeUsdCents,
  getAsnFeeLabel,
  STATUTORY_ADMIN_SETTLEMENT_CENTS,
  STATUTORY_ADMIN_SETTLEMENT_LABEL,
} from "../../../../../../lib/kaas/pricing";
import {
  resolveJurisdiction,
  JURISDICTION_STATUTES,
  buildEvidencePacket,
  formatEvidenceNotice,
} from "../../../../../../lib/forensics/globalVault";

// ── Local types ───────────────────────────────────────────────────────────────

interface CloudflareEnv {
  VAULT_PASSPHRASE?: string;
}

/** Constant-time comparison to prevent timing-based token enumeration. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

interface RouteParams {
  params: Promise<{ asn: string }>;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { asn: rawAsn } = await params;
  const asn = rawAsn?.replace(/^AS/i, "").trim() ?? "";

  if (!asn || !/^\d{1,10}$/.test(asn)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
      "ASN must be a numeric string (e.g. '36459' or 'AS36459').");
  }

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const vaultPass = cfEnv.VAULT_PASSPHRASE ?? "";
  if (vaultPass) {
    const authHeader  = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!safeEqual(bearerToken, vaultPass)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        "Valid Bearer VAULT_PASSPHRASE token required.");
    }
  }

  // ── Parse query params ────────────────────────────────────────────────────
  const url         = new URL(request.url);
  const countryCode = url.searchParams.get("country_code")?.toUpperCase().slice(0, 2) ?? "US";
  const ipAddress   = url.searchParams.get("ip_address") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
  const orgNameQs   = url.searchParams.get("org_name") ?? `ASN ${asn}`;
  const format      = url.searchParams.get("format") ?? "json";
  const rayId       = request.headers.get("cf-ray") ?? url.searchParams.get("ray_id") ?? "";

  // ── KaaS tier assessment ──────────────────────────────────────────────────
  const tier       = getAsnTier(asn);
  const feeCents   = getAsnFeeUsdCents(asn);
  const feeLabel   = getAsnFeeLabel(asn);
  const capCents   = STATUTORY_ADMIN_SETTLEMENT_CENTS;

  // ── Jurisdiction determination ────────────────────────────────────────────
  const jurisdiction = resolveJurisdiction(countryCode);
  const statutes     = JURISDICTION_STATUTES[jurisdiction];

  // ── Build evidence packet ─────────────────────────────────────────────────
  const evidencePacket = buildEvidencePacket({
    ray_id:           rayId,
    asn,
    ip_address:       ipAddress,
    country_code:     countryCode,
    org_name:         orgNameQs,
    ingestion_intent: "KAAS_NOTICE",
    tier,
    valuation_cents:  feeCents,
  });

  // ── Plain-text notice ─────────────────────────────────────────────────────
  if (format === "text") {
    const novText = formatEvidenceNotice(evidencePacket);
    return new Response(novText, {
      status: 200,
      headers: {
        "Content-Type":        "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="NOV-ASN${asn}.txt"`,
        "X-AveryOS-Kernel":    KERNEL_VERSION,
      },
    });
  }

  // ── JSON response ─────────────────────────────────────────────────────────
  const novText = [
    `═══════════════════════════════════════════════════════════════════`,
    `  AveryOS™ NOTICE OF VIOLATION — KaaS (ASN ${asn})`,
    `═══════════════════════════════════════════════════════════════════`,
    ``,
    `  Target ASN:     ${asn}`,
    `  Organisation:   ${orgNameQs}`,
    `  IP Address:     ${ipAddress}`,
    `  Jurisdiction:   ${jurisdiction}`,
    `  Tier:           ${tier}`,
    `  Base Fee:       ${feeLabel}`,
    `  Admin Cap:      ${STATUTORY_ADMIN_SETTLEMENT_LABEL}`,
    ``,
    `  STATUTORY BASIS:`,
    `  ${statutes.full}`,
    ``,
    `  Damage Cap:     ${statutes.damage_cap}`,
    `  Framework:      ${statutes.framework}`,
    ``,
    `  Evidence Packet Fingerprint:`,
    `  ${evidencePacket.packet_fingerprint}`,
    ``,
    `  KERNEL ANCHOR:`,
    `  AveryOS™ Kernel v${KERNEL_VERSION}  |  ${KERNEL_SHA.slice(0, 32)}…`,
    `  Creator: Jason Lee Avery (ROOT0)  |  ⛓️⚓⛓️`,
    `═══════════════════════════════════════════════════════════════════`,
  ].join("\n");

  return Response.json(
    {
      resonance:    "HIGH_FIDELITY_SUCCESS",
      asn,
      org_name:     orgNameQs,
      ip_address:   ipAddress,
      ray_id:       rayId || null,

      // KaaS assessment
      tier,
      fee_label:          feeLabel,
      fee_cents:          feeCents,
      admin_cap_cents:    capCents,
      admin_cap_label:    STATUTORY_ADMIN_SETTLEMENT_LABEL,

      // Jurisdiction
      jurisdiction,
      statutory: {
        short:      statutes.short,
        full:       statutes.full,
        damage_cap: statutes.damage_cap,
        framework:  statutes.framework,
      },

      // Evidence
      evidence_packet_fingerprint: evidencePacket.packet_fingerprint,
      evidence_packet:             evidencePacket,

      // NOV text
      nov_text: novText,

      // Kernel anchor
      kernel_sha:       KERNEL_SHA.slice(0, 32) + "…",
      kernel_version:   KERNEL_VERSION,
      sovereign_anchor: "⛓️⚓⛓️",
      generated_at:     new Date().toISOString(),
    },
    { status: 200 },
  );
}
