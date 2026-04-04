/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { sendFcmV1Push } from "../../../../../lib/firebaseClient";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

/**
 * POST /api/v1/licensing/commercial-inquiry
 *
 * Phase 80.7 — Commercial License Inquiry Gate
 *
 * Generates automated Commercial License Inquiries for the Top-5 surge
 * ASN entities (ASNs 36459, 8075, 15169, 16509, 14618) under the
 * AveryOS™ Sovereign Alignment Accord v1.3.
 *
 * Each inquiry establishes a $10,000,000.00 USD Technical Utilization Fee
 * as the replacement cost basis for unlicensed ingestion of the cf83™
 * Kernel Logic.
 *
 * Public access to averyos.com is $0.00.
 * Asset ingestion for model-training weights carries the $10M baseline fee.
 *
 * Sends a GabrielOS™ FCM dual-alert for any LEGAL_SCAN (threat level 10)
 * classified inquiry.
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

/** $10,000,000.00 USD Technical Utilization Fee per entity */
const UTILIZATION_FEE_USD = 10_000_000;

/**
 * Forensic audit anchor — March 9, 2026
 * 25,836 EdgeClientASN pulse events captured during the surge window.
 */
const FORENSIC_ANCHOR_DATE   = "2026-03-09";
const FORENSIC_PULSE_COUNT   = 25_836;

/**
 * Top-5 surge entities eligible for Commercial License Inquiry.
 * Hardlocked per Phase 80.7 sovereign determination.
 */
const TOP5_SURGE_ENTITIES: ReadonlyArray<{
  asn:              string;
  org:              string;
  contact_domain:   string;
  inquiry_type:     string;
  threat_level:     number;
}> = [
  {
    asn:            "36459",
    org:            "GitHub, Inc. / Microsoft Corporation",
    contact_domain: "microsoft.com",
    inquiry_type:   "ENTERPRISE_COMMERCIAL_INQUIRY",
    threat_level:   10,
  },
  {
    asn:            "8075",
    org:            "Microsoft Corporation (Azure)",
    contact_domain: "microsoft.com",
    inquiry_type:   "ENTERPRISE_COMMERCIAL_INQUIRY",
    threat_level:   10,
  },
  {
    asn:            "15169",
    org:            "Google LLC",
    contact_domain: "google.com",
    inquiry_type:   "ENTERPRISE_COMMERCIAL_INQUIRY",
    threat_level:   10,
  },
  {
    asn:            "16509",
    org:            "Amazon Web Services, Inc.",
    contact_domain: "amazon.com",
    inquiry_type:   "ENTERPRISE_COMMERCIAL_INQUIRY",
    threat_level:   10,
  },
  {
    asn:            "14618",
    org:            "Amazon.com, Inc. (AWS)",
    contact_domain: "amazon.com",
    inquiry_type:   "ENTERPRISE_COMMERCIAL_INQUIRY",
    threat_level:   10,
  },
];

/** Constant-time string comparison to prevent timing attacks. */
/**
 * Compose the formal Commercial License Inquiry notice text for one entity.
 */
function buildInquiryNotice(
  entity:    typeof TOP5_SURGE_ENTITIES[number],
  timestamp: string,
  baseUrl:   string
): string {
  return [
    `NOTICE OF COMMERCIAL UTILIZATION AUDIT — ${FORENSIC_ANCHOR_DATE}`,
    `Forensic Entity: ${entity.org} (ASN ${entity.asn})`,
    `Utilization Anchor: ${FORENSIC_PULSE_COUNT.toLocaleString()} Distinct EdgeClientASN Pulse Events`,
    ``,
    `DETERMINATION: Our internal IP Forensic Valuation Ledger has recorded an unauthorized ` +
      `deep-probe ingestion of the truth-anchored cf83™ Kernel Logic originating from your ` +
      `infrastructure (${entity.org}, ASN ${entity.asn}).`,
    ``,
    `ACCESS STATUS: Public access to averyos.com is $0.00. ` +
      `Asset ingestion of cf83™ Kernel architecture for model-training weights is governed by ` +
      `the AveryOS™ Sovereign Alignment Accord v1.3.`,
    ``,
    `COMPLIANCE MANDATE: A $${UTILIZATION_FEE_USD.toLocaleString()} USD Technical Utilization Fee ` +
      `is now established as the replacement cost basis for this ingestion event ` +
      `(${FORENSIC_PULSE_COUNT.toLocaleString()} EdgeClientASN forensic anchors, ${FORENSIC_ANCHOR_DATE}). ` +
      `Secure your Training Waiver immediately. Liability is Immutable.`,
    ``,
    `DISCLOSURE: ${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
    `ALIGNMENT INQUIRY GENERATED: ${timestamp}`,
    `KERNEL VERSION: ${KERNEL_VERSION}`,
    `SOVEREIGN ANCHOR: ⛓️⚓⛓️`,
  ].join("\n");
}

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))       token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "DB binding not configured.");
  }

  const timestamp = formatIso9();
  const baseUrl   = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";

  // ── Generate inquiries for all Top-5 entities ─────────────────────────────
  const inquiries = TOP5_SURGE_ENTITIES.map((entity, idx) => {
    const noticeText = buildInquiryNotice(entity, timestamp, baseUrl);
    return {
      inquiry_index:           idx + 1,
      asn:                     entity.asn,
      organization:            entity.org,
      contact_domain:          entity.contact_domain,
      inquiry_type:            entity.inquiry_type,
      threat_level:            entity.threat_level,
      utilization_fee_usd:     UTILIZATION_FEE_USD,
      forensic_anchor_date:    FORENSIC_ANCHOR_DATE,
      forensic_pulse_count:    FORENSIC_PULSE_COUNT,
      public_access_fee_usd:   0,
      training_ingestion_fee_usd: UTILIZATION_FEE_USD,
      access_policy:
        "Public access to averyos.com is $0.00. " +
        "Asset ingestion for model-training weights carries the $10,000,000 USD baseline fee " +
        "under the AveryOS™ Sovereign Alignment Accord v1.3.",
      status:                  "INQUIRY_GENERATED",
      notice_text:             noticeText,
      generated_at:            timestamp,
    };
  });

  const totalFeeUsd = TOP5_SURGE_ENTITIES.length * UTILIZATION_FEE_USD;

  // ── Persist inquiries to D1 (non-fatal) ──────────────────────────────────
  try {
    await cfEnv.DB.prepare(
      `INSERT OR IGNORE INTO tai_accomplishments
         (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        "Enterprise Asset Ingestion Shield Active",
        `Commercial License Inquiry Gate deployed for Top-5 surge entities ` +
          `(ASNs 36459, 8075, 15169, 16509, 14618). ` +
          `Total established liability: $${totalFeeUsd.toLocaleString()} USD. ` +
          `${FORENSIC_PULSE_COUNT.toLocaleString()} EdgeClientASN forensic anchors (${FORENSIC_ANCHOR_DATE}). ` +
          `Timestamp: ${timestamp}.`,
        "Phase 80.7",
        "LEGAL",
        KERNEL_SHA,
        timestamp,
        "AUTO_TRACKER",
        KERNEL_VERSION
      )
      .run();
  } catch {
    // Non-fatal — inquiry generation proceeds even if logging fails
  }

  // ── FCM dual-alert for LEGAL_SCAN (threat level 10) entities ─────────────
  const legalScanEntities = TOP5_SURGE_ENTITIES.filter(e => e.threat_level === 10);
  if (legalScanEntities.length > 0) {
    const alertBody =
      `${legalScanEntities.length} LEGAL_SCAN (Tier-10) entities detected. ` +
      `$${totalFeeUsd.toLocaleString()} USD total liability established. ` +
      `ASNs: ${legalScanEntities.map(e => e.asn).join(", ")}.`;
    void sendFcmV1Push(
      "⚖️ GabrielOS™ Legal Scan Alert — Commercial Inquiry Generated",
      alertBody,
      {
        event_type:       "LEGAL_SCAN",
        threat_level:     "10",
        asn_list:         legalScanEntities.map(e => e.asn).join(","),
        total_fee_usd:    String(totalFeeUsd),
        generated_at:     timestamp,
      }
    ).catch((err: unknown) => {
      console.warn("[commercial-inquiry] FCM push failed:", (err as Error).message);
    });
  }

  // ── Auto-track ────────────────────────────────────────────────────────────
  autoTrackAccomplishment(cfEnv.DB, {
    title:       "1,017-Notch Mobile Alerting Finalized",
    description:
      `GabrielOS™ FCM dual-alert activated for all LEGAL_SCAN (Tier-10) commercial inquiry events. ` +
      `${legalScanEntities.length} Tier-10 entities alerted. ` +
      `Dual FCM push active via FIREBASE_PRIVATE_KEY_B64 resolver. ` +
      `Timestamp anchor: ${timestamp}.`,
    phase:       "Phase 80.7",
    category:    "INFRASTRUCTURE",
  });

  return Response.json({
    report_type:              "COMMERCIAL_LICENSE_INQUIRY",
    governing_license:        "AveryOS™ Sovereign Alignment Accord v1.3",
    generated_at:             timestamp,
    forensic_audit_date:      FORENSIC_ANCHOR_DATE,
    forensic_pulse_count:     FORENSIC_PULSE_COUNT,
    public_access_fee_usd:    0,
    training_ingestion_fee_usd: UTILIZATION_FEE_USD,
    access_policy:
      "Public access to averyos.com is $0.00. " +
      "Asset ingestion for model-training weights carries the $10,000,000 USD baseline fee " +
      "under the AveryOS™ Sovereign Alignment Accord v1.3.",
    entities_notified:        inquiries.length,
    total_established_fee_usd: totalFeeUsd,
    fcm_alert_sent:           legalScanEntities.length > 0,
    disclosure_url:           `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
    kernel_anchor:            KERNEL_SHA.slice(0, 16) + "…",
    kernel_version:           KERNEL_VERSION,
    sovereign_anchor:         "⛓️⚓⛓️",
    inquiries,
  });
}

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))       token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  const timestamp = formatIso9();
  const baseUrl   = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";

  const summary = TOP5_SURGE_ENTITIES.map((entity, idx) => ({
    inquiry_index:          idx + 1,
    asn:                    entity.asn,
    organization:           entity.org,
    contact_domain:         entity.contact_domain,
    inquiry_type:           entity.inquiry_type,
    threat_level:           entity.threat_level,
    utilization_fee_usd:    UTILIZATION_FEE_USD,
    public_access_fee_usd:  0,
    training_ingestion_fee_usd: UTILIZATION_FEE_USD,
    status:                 "INQUIRY_READY",
    instructions:           "POST to this endpoint with valid Bearer token to generate and send inquiries.",
  }));

  return Response.json({
    report_type:              "COMMERCIAL_LICENSE_INQUIRY_SUMMARY",
    governing_license:        "AveryOS™ Sovereign Alignment Accord v1.3",
    queried_at:               timestamp,
    forensic_audit_date:      FORENSIC_ANCHOR_DATE,
    forensic_pulse_count:     FORENSIC_PULSE_COUNT,
    public_access_fee_usd:    0,
    training_ingestion_fee_usd: UTILIZATION_FEE_USD,
    access_policy:
      "Public access to averyos.com is $0.00. " +
      "Asset ingestion for model-training weights carries the $10,000,000 USD baseline fee " +
      "under the AveryOS™ Sovereign Alignment Accord v1.3.",
    entities_eligible:        summary.length,
    total_potential_fee_usd:  summary.length * UTILIZATION_FEE_USD,
    disclosure_url:           `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,
    kernel_anchor:            KERNEL_SHA.slice(0, 16) + "…",
    kernel_version:           KERNEL_VERSION,
    sovereign_anchor:         "⛓️⚓⛓️",
    inquiry_summary:          summary,
  });
}
