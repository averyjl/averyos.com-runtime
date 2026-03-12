/**
 * POST /api/v1/compliance/notify
 *
 * Compliance Notice System — AveryOS™ Phase 106 / GATE 106.4
 *
 * One-way "Notice of Violation" (NOV) delivery system that:
 *   1. Accepts a target entity (ASN or IP address).
 *   2. Starts a 72-hour settlement clock for the entity.
 *   3. Persists the notice to compliance_clocks and sovereign_audit_logs.
 *   4. Returns the NOV payload and deadline for downstream delivery
 *      (email, webhook, or Pushover/FCM alert).
 *
 * Goal: Initiate the 72-hour compliance window with a legally-stamped
 * Notice of Violation that can be forwarded to the ASN/IP entity.
 *
 * Statutory Basis:
 *   • 17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work
 *     for willful copyright infringement.
 *   • 17 U.S.C. § 1201 — DMCA Anti-Circumvention.
 *   • CFAA 18 U.S.C. § 1030 — Unauthorized computer access.
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }        from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION }  from "../../../../../lib/sovereignConstants";
import { formatIso9 }                  from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment }     from "../../../../../lib/taiAutoTracker";
import {
  createComplianceClock,
  SETTLEMENT_WINDOW_HOURS,
} from "../../../../../lib/compliance/clockEngine";
import { getAsnTier, getAsnFeeUsdCents, getAsnFeeLabel,
         STATUTORY_ADMIN_SETTLEMENT_CENTS, STATUTORY_ADMIN_SETTLEMENT_LABEL,
} from "../../../../../lib/kaas/pricing";
import { resolveJurisdiction, JURISDICTION_STATUTES }
  from "../../../../../lib/forensics/globalVault";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

// ── Local types ───────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...v: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:                   D1Database;
  VAULT_PASSPHRASE?:     string;
  SITE_URL?:             string;
  NEXT_PUBLIC_SITE_URL?: string;
}

/** Constant-time comparison to prevent timing-based token enumeration. */
/** SHA-512 hex digest using the Web Crypto API. */
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Route Handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/compliance/notify
 *
 * Body:
 *   {
 *     asn?:           string;   // Target ASN (e.g. "36459")
 *     ip_address?:    string;   // Target IP address
 *     org_name?:      string;   // organization name for the notice
 *     country_code?:  string;   // ISO-3166 two-letter country code
 *     ray_id?:        string;   // Cloudflare RayID for forensic linking
 *     debt_cents?:    number;   // Override debt amount in cents
 *     notice_type?:   string;   // "NOV_72H" (default) | "FINAL_DEMAND"
 *   }
 */
export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const baseUrl = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";
  const now     = formatIso9();

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

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await request.json(); }
  catch { return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON."); }

  if (typeof body !== "object" || body === null) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body is required.");
  }

  const {
    asn:           asnRaw,
    ip_address:    ipAddress,
    org_name:      orgName,
    country_code:  countryCode,
    ray_id:        rayId,
    debt_cents:    debtCentsOverride,
    notice_type:   noticeTypeRaw,
  } = body as Record<string, unknown>;

  const asn         = typeof asnRaw    === "string" ? asnRaw.trim()    : "";
  const ipStr       = typeof ipAddress === "string" ? ipAddress.trim() : (request.headers.get("cf-connecting-ip") ?? "unknown");
  const orgStr      = typeof orgName   === "string" ? orgName.trim()   : (asn ? `ASN ${asn}` : "Unknown Entity");
  const ccStr       = typeof countryCode === "string" ? countryCode.toUpperCase().slice(0, 2) : "US";
  const rayStr      = typeof rayId     === "string" ? rayId.trim()     : (request.headers.get("cf-ray") ?? "");
  const noticeType  = typeof noticeTypeRaw === "string" &&
    ["NOV_72H", "FINAL_DEMAND"].includes(noticeTypeRaw.toUpperCase())
      ? noticeTypeRaw.toUpperCase()
      : "NOV_72H";

  if (!asn && !ipStr) {
    return aosErrorResponse(AOS_ERROR.MISSING_FIELD,
      "At least one of asn or ip_address is required.");
  }

  // ── Determine tier and debt ───────────────────────────────────────────────
  const tier         = asn ? getAsnTier(asn) : 1;
  const baseCents    = asn ? getAsnFeeUsdCents(asn) : 101_700;
  const feeLabel     = asn ? getAsnFeeLabel(asn) : "$1,017.00";
  const effectiveCents = typeof debtCentsOverride === "number" && debtCentsOverride > 0
    ? Math.round(debtCentsOverride)
    : Math.min(baseCents, STATUTORY_ADMIN_SETTLEMENT_CENTS);

  // ── Determine jurisdiction ────────────────────────────────────────────────
  const jurisdiction = resolveJurisdiction(ccStr);
  // eslint-disable-next-line security/detect-object-injection
  const statutes     = JURISDICTION_STATUTES[jurisdiction];

  // ── Start 72-hour compliance clock ───────────────────────────────────────
  const clockId = `clock_nov_${asn || ipStr}_${Date.now()}`;
  const clock   = await createComplianceClock(asn || null, orgStr, clockId);

  // ── Generate NOV fingerprint ─────────────────────────────────────────────
  const novInput   = [asn, ipStr, orgStr, now, KERNEL_SHA].join("|");
  const novToken   = await sha512hex(novInput);

  // ── Persist to D1 compliance_clocks (fire-and-forget) ────────────────────
  if (cfEnv.DB) {
    cfEnv.DB.prepare(
      `INSERT OR IGNORE INTO compliance_clocks
         (clock_id, entity_id, asn, org_name, status, issued_at, deadline_at,
          source_endpoint, debt_cents, kernel_sha, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        clockId,
        asn || ipStr,
        asn || null,
        orgStr,
        clock.issued_at,
        clock.deadline_at,
        "/api/v1/compliance/notify",
        effectiveCents,
        KERNEL_SHA,
        now,
      )
      .run()
      .catch((err: unknown) => {
        console.warn("[notify] D1 clock persist failed:", err instanceof Error ? err.message : String(err));
      });

    // Audit log — includes SHA-512 pulse_hash receipt for VaultChain™ permanence
    cfEnv.DB.prepare(
      `INSERT OR IGNORE INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, target_path, timestamp_ns, threat_level,
          kernel_sha, asn, client_country, ingestion_intent, pulse_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        "COMPLIANCE_NOTICE_ISSUED",
        ipStr,
        request.headers.get("user-agent") ?? "unknown",
        "/api/v1/compliance/notify",
        now,
        tier >= 9 ? 10 : tier >= 7 ? 7 : 5,
        KERNEL_SHA,
        asn || null,
        ccStr,
        "COMPLIANCE_NOTICE",
        novToken,
      )
      .run()
      .catch((err: unknown) => {
        console.warn("[notify] D1 audit log failed:", err instanceof Error ? err.message : String(err));
      });

    // VaultChain™ SHA-512 pulse receipt — GATE 110.1.5
    if (clock.pulse_hash) {
      cfEnv.DB.prepare(
        `INSERT OR IGNORE INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, target_path, timestamp_ns, threat_level,
            kernel_sha, asn, client_country, ingestion_intent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          "COMPLIANCE_CLOCK_SHA512_RECEIPT",
          ipStr,
          request.headers.get("user-agent") ?? "unknown",
          "/api/v1/compliance/notify",
          now,
          tier >= 9 ? 10 : tier >= 7 ? 7 : 5,
          KERNEL_SHA,
          asn || null,
          ccStr,
          `PULSE_HASH:${clock.pulse_hash}`,
        )
        .run()
        .catch((err: unknown) => {
          console.warn("[notify] D1 pulse receipt log failed:", err instanceof Error ? err.message : String(err));
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTrackAccomplishment(cfEnv.DB as any, {
      title:       "Compliance Notice Issued",
      description: `NOV issued to ${orgStr} (ASN ${asn || "N/A"}). ` +
        `Clock: ${clockId}. Debt: $${(effectiveCents / 100).toFixed(2)} USD.`,
      category:    "LEGAL",
      ray_id:      rayStr || undefined,
    });
  }

  // ── Build the NOV text ────────────────────────────────────────────────────
  const novText = [
    `═══════════════════════════════════════════════════════════════════`,
    `  AveryOS™ NOTICE OF VIOLATION — ${noticeType}`,
    `═══════════════════════════════════════════════════════════════════`,
    ``,
    `  Issued To:        ${orgStr}`,
    `  ASN:              ${asn || "N/A"}`,
    `  IP Address:       ${ipStr}`,
    `  Jurisdiction:     ${jurisdiction}`,
    `  Issued At:        ${clock.issued_at}`,
    `  Settlement By:    ${clock.deadline_at}  (${SETTLEMENT_WINDOW_HOURS} hours)`,
    `  Clock ID:         ${clockId}`,
    `  NOV Token:        ${novToken.slice(0, 32)}…`,
    ``,
    `  STATUTORY BASIS:`,
    `  ${statutes.full}`,
    ``,
    `  TIER ASSESSMENT:`,
    `  Tier: ${tier}  |  Base Valuation: ${feeLabel}`,
    `  Administrative Settlement Cap: ${STATUTORY_ADMIN_SETTLEMENT_LABEL}`,
    `  Effective Debt (this notice):  $${(effectiveCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ``,
    `  TO RESOLVE THIS NOTICE:`,
    `  Settlement Portal: ${baseUrl}/licensing/enterprise`,
    `  KaaS Settlement:   ${baseUrl}/api/v1/kaas/settle`,
    `  Clock Status:      ${baseUrl}/api/v1/compliance/clock-status?entity_id=${asn || ipStr}`,
    ``,
    `  KERNEL ANCHOR:`,
    `  AveryOS™ Kernel v${KERNEL_VERSION}  |  ${KERNEL_SHA.slice(0, 32)}…`,
    `  Creator: Jason Lee Avery (ROOT0)  |  ⛓️⚓⛓️`,
    `═══════════════════════════════════════════════════════════════════`,
  ].join("\n");

  return Response.json(
    {
      resonance:          "COMPLIANCE_NOTICE_ISSUED",
      notice_type:        noticeType,
      nov_token:          novToken,
      issued_at:          clock.issued_at,
      timestamp:          now,

      // Entity
      target: {
        asn:           asn || null,
        ip_address:    ipStr,
        org_name:      orgStr,
        country_code:  ccStr,
        jurisdiction,
        tier,
        ray_id:        rayStr || null,
      },

      // Clock
      settlement_deadline: {
        clock_id:     clockId,
        issued_at:    clock.issued_at,
        deadline_at:  clock.deadline_at,
        window_hours: SETTLEMENT_WINDOW_HOURS,
        status:       clock.status,
      },

      // Debt
      liability: {
        base_fee_label:    feeLabel,
        effective_cents:   effectiveCents,
        effective_usd:     (effectiveCents / 100).toFixed(2),
        admin_settlement:  STATUTORY_ADMIN_SETTLEMENT_LABEL,
      },

      // Statutory basis
      statutory: {
        jurisdiction,
        short:      statutes.short,
        damage_cap: statutes.damage_cap,
        framework:  statutes.framework,
      },

      // Human-readable NOV text
      nov_text:           novText,

      // Settlement paths
      settlement_url:     `${baseUrl}/licensing/enterprise`,
      kaas_settle_url:    `${baseUrl}/api/v1/kaas/settle`,
      clock_status_url:   `${baseUrl}/api/v1/compliance/clock-status?entity_id=${asn || ipStr}`,

      // Kernel anchor
      kernel_sha:         KERNEL_SHA.slice(0, 32) + "…",
      kernel_version:     KERNEL_VERSION,
      sovereign_anchor:   "⛓️⚓⛓️",
    },
    { status: 202 },
  );
}
