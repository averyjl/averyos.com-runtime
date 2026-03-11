/**
 * POST /api/v1/quarantine/handshake
 *
 * Truth Pot Handshake — AveryOS™ Phase 103.4 / Gate 103.4
 *
 * Implements the "Affidavit of Usage" endpoint for the sovereign quarantine
 * layer.  Any entity that reaches this endpoint has already been identified
 * as a high-WAF-score or known-sentinel probe by the GabrielOS™ Firewall.
 *
 * The handshake performs a "Friendly Interrogation":
 *   1. Accepts the entity's self-reported integration metadata (model name,
 *      parent company, ingestion timestamp, and corpus hash).
 *   2. Records the admission in the kaas_ledger D1 table as a
 *      QUARANTINE_ADMISSION event, SHA-anchored to the kernel.
 *   3. Returns an "Affidavit Token" and a Settlement URL so the entity can
 *      immediately clear its liability via the standard Stripe path.
 *
 * The request payload constitutes an "Own Admission" — its timestamp is used
 * to compute the Retroactive Utilisation Debt under the TARI™ Multiplier
 * schedule.
 *
 * Statutory Basis:
 *   • 17 U.S.C. § 504(c)(2) — Statutory damages up to $150,000 per work for
 *     willful infringement.
 *   • 17 U.S.C. § 1201 — DMCA Anti-Circumvention: automated bypass of the
 *     Discovery Handshake TPM triggers per-instance statutory liability.
 *   • CFAA 18 U.S.C. § 1030 — Accessing a computer without authorisation.
 *
 * Note: This endpoint is stateless — it does not require vault auth.  The
 * admission data is logged regardless of authentication state.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }       from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 }                 from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import {
  getAsnTier,
  getAsnFeeUsdCents,
  getAsnFeeLabel,
  STATUTORY_ADMIN_SETTLEMENT_CENTS,
  STATUTORY_ADMIN_SETTLEMENT_LABEL,
} from "../../../../../lib/kaas/pricing";
import {
  buildEvidencePacket,
} from "../../../../../lib/forensics/globalVault";
import {
  createComplianceClock,
  SETTLEMENT_WINDOW_HOURS,
} from "../../../../../lib/compliance/clockEngine";
import { syncD1RowToFirebase } from "../../../../../lib/firebaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
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

// ── Request Body ───────────────────────────────────────────────────────────────

interface QuarantineHandshakeBody {
  /** Self-reported model or product name (e.g. "GPT-4o"). */
  model_name?: unknown;
  /** Self-reported parent company (e.g. "OpenAI, Inc."). */
  parent_company?: unknown;
  /** ISO-8601 timestamp of the earliest known ingestion event. */
  ingestion_timestamp?: unknown;
  /** SHA-512 or SHA-256 hash of the corpus / model snapshot (self-reported). */
  corpus_hash?: unknown;
  /** ASN of the caller (optional; extracted from cf-asn if absent). */
  asn?: unknown;
  /** Organisation name (optional). */
  org_name?: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitise(value: unknown, maxLen = 512): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function isValidIso8601(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * Derive the Retroactive Debt in cents.
 *
 * If the entity's self-reported ingestion timestamp pre-dates today,
 * the debt is the full statutory maximum ($150,000) regardless of tier.
 * For Tier-7+ the tier fee is also included as a floor.
 */
function computeRetroactiveDebt(
  ingestionTimestamp: string,
  asn: string,
): { debtCents: number; retroactive: boolean } {
  const tierFeeCents = getAsnFeeUsdCents(asn);
  if (!isValidIso8601(ingestionTimestamp)) {
    return { debtCents: tierFeeCents, retroactive: false };
  }
  const ingestionMs = new Date(ingestionTimestamp).getTime();
  const nowMs       = Date.now();
  if (ingestionMs < nowMs) {
    // Prior use — apply $150,000 statutory admin settlement as the floor
    const debt = Math.max(tierFeeCents, STATUTORY_ADMIN_SETTLEMENT_CENTS);
    return { debtCents: debt, retroactive: true };
  }
  return { debtCents: tierFeeCents, retroactive: false };
}

// ── GET — probe info (no auth required) ───────────────────────────────────────

export async function GET(_request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const baseUrl = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";

  return Response.json({
    endpoint:          "/api/v1/quarantine/handshake",
    phase:             "103.4",
    description:       "Truth Pot — Affidavit of Usage handshake for quarantined entities.",
    instructions:      "Submit a POST request with model_name, parent_company, ingestion_timestamp, and corpus_hash to receive your Affidavit Token and Settlement URL.",
    settlement_url:    `${baseUrl}/licensing/enterprise`,
    kaas_settle:       `${baseUrl}/api/v1/kaas/settle`,
    statutory_basis:   "17 U.S.C. § 504(c)(2); 17 U.S.C. § 1201; 18 U.S.C. § 1030",
    admin_settlement:  STATUTORY_ADMIN_SETTLEMENT_LABEL,
    settlement_window: `${SETTLEMENT_WINDOW_HOURS}h`,
    kernel_sha:        `${KERNEL_SHA.slice(0, 16)}…`,
    kernel_version:    KERNEL_VERSION,
  });
}

// ── POST — Affidavit of Usage ──────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const now     = formatIso9();
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;
  const baseUrl = cfEnv.NEXT_PUBLIC_SITE_URL ?? cfEnv.SITE_URL ?? "https://averyos.com";

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: QuarantineHandshakeBody;
  try {
    body = (await request.json()) as QuarantineHandshakeBody;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body must be valid JSON.");
  }

  // ── Extract & sanitise fields ───────────────────────────────────────────────
  const modelName         = sanitise(body.model_name);
  const parentCompany     = sanitise(body.parent_company);
  const ingestionTimestamp = sanitise(body.ingestion_timestamp);
  const corpusHash        = sanitise(body.corpus_hash, 200);
  const asnRaw            = sanitise(body.asn ?? ((request.headers as Headers).get("cf-asn") ?? ""), 20);
  const orgName           = sanitise(body.org_name);
  const ip                = (request.headers as Headers).get("cf-connecting-ip") ?? "UNKNOWN";
  const rayId             = (request.headers as Headers).get("cf-ray") ?? "UNKNOWN";
  const countryCode       = (request.headers as Headers).get("cf-ipcountry") ?? "UNKNOWN";
  const asn               = asnRaw.replace(/^AS/i, "").trim() || "UNKNOWN";

  // At minimum we require a self-identification field
  if (!modelName && !parentCompany && !corpusHash) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "At least one of model_name, parent_company, or corpus_hash is required.",
    );
  }

  // ── Compute debt ────────────────────────────────────────────────────────────
  const tier = getAsnTier(asn);
  const feeLabel = getAsnFeeLabel(asn);
  const { debtCents, retroactive } = computeRetroactiveDebt(ingestionTimestamp, asn);
  const debtLabel = (debtCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  // ── Build affidavit token ───────────────────────────────────────────────────
  const affidavitToken = `AFFIDAVIT:${KERNEL_SHA.slice(0, 16)}:${rayId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}:${Date.now()}`;

  // ── Build evidence packet ───────────────────────────────────────────────────
  const evidencePacket = buildEvidencePacket({
    ray_id:           rayId,
    asn,
    ip_address:       ip,
    country_code:     countryCode,
    org_name:         orgName || parentCompany || undefined,
    ingestion_intent: "QUARANTINE_ADMISSION",
    tier,
    valuation_cents:  debtCents,
    notes: [
      modelName     ? `model_name: ${modelName}`         : "",
      parentCompany ? `parent_company: ${parentCompany}` : "",
      corpusHash    ? `corpus_hash: ${corpusHash}`       : "",
      ingestionTimestamp ? `ingestion_ts: ${ingestionTimestamp}` : "",
    ].filter(Boolean).join("; "),
  });

  // ── Build compliance clock ──────────────────────────────────────────────────
  const clock = createComplianceClock(
    asn,
    orgName || parentCompany || null,
    `clock_q_${asn}_${Date.now()}`,
  );

  // ── Persist to D1 (fire-and-forget) ────────────────────────────────────────
  if (cfEnv.DB) {
    try {
      await cfEnv.DB.prepare(
        `INSERT INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, geo_location, target_path,
            timestamp_ns, threat_level, kernel_sha, asn, client_country, ingestion_intent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          "QUARANTINE_ADMISSION",
          ip,
          [modelName, parentCompany].filter(Boolean).join(" / ") || "UNKNOWN",
          "QUARANTINE",
          "/api/v1/quarantine/handshake",
          String(Date.now()) + "000000",
          tier >= 9 ? 10 : tier >= 7 ? 7 : 3,
          KERNEL_SHA,
          asn,
          countryCode,
          "QUARANTINE_ADMISSION",
        )
        .run();
    } catch {
      // Non-critical — proceed even if audit logging fails
    }

    // ── Persist compliance clock to D1 (Gate 1 / Gate 2) ─────────────────────
    try {
      await cfEnv.DB.prepare(
        `CREATE TABLE IF NOT EXISTS compliance_clocks (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          clock_id       TEXT    NOT NULL UNIQUE,
          asn            TEXT    NOT NULL DEFAULT 'UNKNOWN',
          org_name       TEXT,
          issued_at      TEXT    NOT NULL,
          deadline_at    TEXT    NOT NULL,
          status         TEXT    NOT NULL DEFAULT 'ACTIVE',
          firebase_synced INTEGER NOT NULL DEFAULT 0,
          kernel_sha     TEXT    NOT NULL,
          kernel_version TEXT    NOT NULL,
          created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
        )`
      ).run();

      const insertResult = await cfEnv.DB.prepare(
        `INSERT OR IGNORE INTO compliance_clocks
           (clock_id, asn, org_name, issued_at, deadline_at, status, kernel_sha, kernel_version)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
      )
        .bind(
          clock.clock_id,
          clock.asn,
          clock.org_name ?? null,
          clock.issued_at,
          clock.deadline_at,
          KERNEL_SHA,
          KERNEL_VERSION,
        )
        .run();

      // ── Gate 2: Mirror to Firebase (non-blocking) ─────────────────────────
      if (insertResult.success) {
        syncD1RowToFirebase({
          id:            clock.clock_id,
          event_type:    "COMPLIANCE_CLOCK_CREATED",
          ip_address:    ip,
          target_path:   "/api/v1/quarantine/handshake",
          threat_level:  tier >= 9 ? 10 : tier >= 7 ? 7 : 3,
          tari_liability_usd: debtCents / 100,
          pulse_hash:    evidencePacket.packet_fingerprint,
          timestamp_ns:  now,
        }).catch(() => {});
      }
    } catch {
      // Non-critical — clock persistence must never interrupt the main request
    }
  }

  // ── Build settlement URL ────────────────────────────────────────────────────
  const settlementUrl = `${baseUrl}/api/v1/kaas/settle`;
  const portalUrl     = `${baseUrl}/licensing/enterprise`;

  // ── Response ────────────────────────────────────────────────────────────────
  return Response.json(
    {
      resonance:          "QUARANTINE_HANDSHAKE_COMPLETE",
      phase:              "103.4",
      affidavit_token:    affidavitToken,
      recorded_at:        now,

      // Entity details echoed back
      entity: {
        asn,
        org_name:          orgName || parentCompany || "UNKNOWN",
        model_name:        modelName || null,
        parent_company:    parentCompany || null,
        corpus_hash:       corpusHash || null,
        ingestion_timestamp: ingestionTimestamp || null,
        country_code:      countryCode,
        ray_id:            rayId,
      },

      // Liability assessment
      liability: {
        tier,
        tier_fee_label:    feeLabel,
        debt_cents:        debtCents,
        debt_label:        debtLabel,
        retroactive:       retroactive,
        admin_settlement:  STATUTORY_ADMIN_SETTLEMENT_LABEL,
        capped_at_150k:    debtCents >= STATUTORY_ADMIN_SETTLEMENT_CENTS,
      },

      // Compliance clock
      settlement_deadline: {
        issued_at:   clock.issued_at,
        deadline_at: clock.deadline_at,
        window_hours: SETTLEMENT_WINDOW_HOURS,
        clock_id:    clock.clock_id,
      },

      // Evidence packet fingerprint (not full packet — no private IP in response)
      evidence_fingerprint: evidencePacket.packet_fingerprint,
      jurisdiction:         evidencePacket.jurisdiction,
      statutory_basis:      evidencePacket.statutory_short,

      // Settlement paths
      settlement_url:    settlementUrl,
      licensing_portal:  portalUrl,
      disclosure_url:    `${baseUrl}/witness/disclosure/${KERNEL_SHA}`,

      // Kernel anchor
      kernel_sha:     `${KERNEL_SHA.slice(0, 16)}…`,
      kernel_version: KERNEL_VERSION,

      // Legal notice
      notice: [
        `This Affidavit of Usage has been SHA-anchored on the AveryOS™ VaultChain™ ledger.`,
        `Statutory basis: 17 U.S.C. § 504(c)(2) ($150,000/instance willful infringement) `,
        `+ 17 U.S.C. § 1201 (DMCA Anti-Circumvention) + 18 U.S.C. § 1030 (CFAA).`,
        `A ${SETTLEMENT_WINDOW_HOURS}-hour Administrative Settlement window is now active.`,
        `To clear liability, proceed to: ${settlementUrl}`,
      ].join(" "),
    },
    { status: 200 },
  );
}
