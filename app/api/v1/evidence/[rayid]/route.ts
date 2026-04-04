/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA, KERNEL_VERSION } from '../../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';
import { buildEvidencePacket, resolveJurisdiction, formatEvidenceNotice }
  from '../../../../../lib/forensics/globalVault';
import { safeEqual } from '../../../../../lib/taiLicenseGate';

/**
 * GET /api/v1/evidence/[rayid]
 *
 * Fetches the raw Cloudflare telemetry JSON evidence bundle for a given
 * Cloudflare RayID from VAULT_R2 (stored at evidence/${rayid}.json).
 *
 * Roadmap Gate 2.3: Wires buildEvidencePacket() from globalVault.ts to
 * produce a downloadable multi-jurisdictional evidence packet alongside
 * the raw telemetry data.
 *
 * Query params:
 *   format=packet  — Return the full evidence packet (JSON) from globalVault.ts
 *   format=notice  — Return human-readable NOV text from formatEvidenceNotice()
 *   format=raw     — Return raw R2 telemetry (default)
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE
 *       (same gate as /api/v1/audit-stream).
 *
 * Returns the full JSON metadata object captured by logSovereignAudit()
 * in middleware.ts, including WAF scores, edge timestamps, geolocation,
 * INGESTION_INTENT classification, and kernel_sha anchor.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface R2Object {
  text(): Promise<string>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

interface CloudflareEnv {
  VAULT_R2?: R2Bucket;
  VAULT_PASSPHRASE?: string;
}

interface RouteParams {
  params: Promise<{ rayid: string }>;
}

const RAY_ID_RE = /^[a-zA-Z0-9]{16,32}$/;

export async function GET(request: Request, { params }: RouteParams) {
  const { rayid } = await params;

  if (!rayid || !RAY_ID_RE.test(rayid)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
      'rayid must be a 16–32 character alphanumeric Cloudflare RayID');
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE;
  if (vaultPassphrase) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!safeEqual(token, vaultPassphrase)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        'Valid Bearer token required to access forensic evidence');
    }
  }

  // ── R2 Fetch ──────────────────────────────────────────────────────────────
  if (!cfEnv.VAULT_R2) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING,
      'VAULT_R2 binding is not configured');
  }

  const key = `evidence/${rayid}.json`;
  const obj = await cfEnv.VAULT_R2.get(key).catch(() => null);

  if (!obj) {
    return aosErrorResponse(AOS_ERROR.NOT_FOUND,
      `No evidence bundle found for RayID: ${rayid}. Evidence is only stored for requests that triggered logSovereignAudit().`);
  }

  const raw = await obj.text();
  const telemetry = JSON.parse(raw) as Record<string, unknown>;

  // ── Roadmap Gate 2.3: Build multi-jurisdictional evidence packet ──────────
  const url    = new URL(request.url);
  const format = url.searchParams.get("format") ?? "raw";

  if (format === "packet" || format === "notice") {
    // Extract metadata from the telemetry bundle
    const asn         = String(telemetry.asn         ?? telemetry.client_asn    ?? "");
    const ipAddress   = String(telemetry.ip_address  ?? telemetry.client_ip     ?? "");
    const countryCode = String(telemetry.country     ?? telemetry.client_country ?? "US");
    const orgName     = String(telemetry.org_name    ?? telemetry.ingestion_intent ?? "");
    const ingestionIntent = String(telemetry.ingestion_intent ?? "UNKNOWN");

    // Resolve tier from ASN (import from pricing at build time)
    const jurisdiction = resolveJurisdiction(countryCode);

    const evidencePacket = buildEvidencePacket({
      ray_id:           rayid,
      asn,
      ip_address:       ipAddress,
      country_code:     countryCode,
      org_name:         orgName,
      ingestion_intent: ingestionIntent,
      tier:             1, // will be re-resolved from ASN by buildEvidencePacket
      valuation_cents:  0,
    });

    if (format === "notice") {
      const notice = formatEvidenceNotice(evidencePacket);
      return new Response(notice, {
        status: 200,
        headers: {
          "Content-Type":        "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="NOV-${rayid}.txt"`,
          "X-AveryOS-Kernel":    KERNEL_VERSION,
        },
      });
    }

    return Response.json({
      resonance:         "HIGH_FIDELITY_SUCCESS",
      kernel_sha:        KERNEL_SHA,
      kernel_version:    KERNEL_VERSION,
      ray_id:            rayid,
      jurisdiction,
      evidence_packet:   evidencePacket,
      retrieved_at:      new Date().toISOString(),
    });
  }

  return Response.json({
    resonance:    'HIGH_FIDELITY_SUCCESS',
    kernel_sha:   KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    ray_id:       rayid,
    r2_key:       key,
    evidence:     telemetry,
    retrieved_at: new Date().toISOString(),
  });
}
