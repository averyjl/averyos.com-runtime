import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { calculateTariDebt } from "../../../../../lib/tari/calculator";
import { startSettlementClock } from "../../../../../lib/compliance/clockEngine";

/**
 * POST /api/v1/licensing/handshake
 *
 * Phase 102.1 — Attestation Handshake (Usage Affidavit Gate)
 *
 * Implements the Frictionless Discovery Handshake. The calling entity
 * provides a voluntary Usage Affidavit containing its first-ingestion
 * timestamp and model/system identifier. The endpoint:
 *
 *   1. Validates and records the attestation in D1 (kaas_ledger table).
 *   2. Calculates the TARI™ sovereign debt via lib/tari/calculator.ts.
 *   3. Starts the 72-hour Settlement Clock via lib/compliance/clockEngine.ts.
 *   4. Returns a structured Affidavit Receipt anchored to the cf83™ Kernel.
 *
 * The affidavit is anchored via SHA-512 and stored as a VaultChain™ record.
 * All responses reference the public disclosure at DISCLOSURE_MIRROR_PATH.
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE, OR public
 *       access for anonymous entities submitting voluntary disclosure.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
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

// ── Request Body ─────────────────────────────────────────────────────────────

interface HandshakeBody {
  /** ISO-8601 timestamp of the entity's claimed first ingestion of AveryOS™ IP. */
  first_ingestion_ts?: string | null;
  /** Internal model or system identifier provided voluntarily by the entity. */
  model_id?: string | null;
  /** Client ASN string for TARI™ tier calculation. */
  asn?: string | null;
  /** Optional human-readable organization name. */
  org_name?: string | null;
  /** Any additional integration documentation provided by the entity. */
  integration_docs?: unknown;
}

// ── SHA-512 Anchor ────────────────────────────────────────────────────────────

/** Compute a SHA-512 hex digest of an attestation payload using Web Crypto. */
async function sha512Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf     = await crypto.subtle.digest("SHA-512", encoder.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: HandshakeBody;
  try {
    body = (await request.json()) as HandshakeBody;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const now      = new Date();
  const nowIso   = formatIso9(now);
  const asn      = String(body.asn ?? "").trim() || "0";
  const modelId  = String(body.model_id ?? "").slice(0, 256).trim() || "UNDISCLOSED";
  const orgName  = String(body.org_name ?? "").slice(0, 128).trim() || undefined;
  const ingestTs = body.first_ingestion_ts
    ? String(body.first_ingestion_ts).trim()
    : nowIso;

  // ── Obfuscation Detection — read flag set by Phase 102.3 middleware ───────
  const obfuscationDetected =
    request.headers.get("x-gabrielos-infringement-multiplier") === "10x";

  // ── TARI™ Debt Calculation ────────────────────────────────────────────────
  const tariResult = calculateTariDebt({
    asn,
    attestedIngestionTs:  ingestTs,
    obfuscationDetected,
    entityName:           orgName,
  });

  // ── SHA-512 Anchor ────────────────────────────────────────────────────────
  const attestationPayload = JSON.stringify({
    first_ingestion_ts:  ingestTs,
    model_id:            modelId,
    asn,
    org_name:            orgName ?? null,
    tari_debt_cents:     tariResult.totalDebtCents,
    kernel_sha:          KERNEL_SHA,
    recorded_at:         nowIso,
  });
  const attestationSha = await sha512Hex(attestationPayload);

  // ── Settlement Clock ──────────────────────────────────────────────────────
  const settlementClock = startSettlementClock(nowIso);

  // ── D1 Insert ─────────────────────────────────────────────────────────────
  let dbSuccess = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    if (cfEnv.DB) {
      await cfEnv.DB.prepare(
        `INSERT INTO kaas_ledger
           (entity_name, asn, org_name, ray_id, ingestion_proof_sha,
            amount_owed, settlement_status, knowledge_cutoff_correlation,
            kernel_sha, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          modelId,                                   // entity_name — model/system identifier
          asn,
          orgName ?? null,
          attestationSha.slice(0, 64),               // ray_id — SHA prefix as unique key
          attestationSha,                            // ingestion_proof_sha — full SHA-512
          tariResult.totalDebtCents / 100,           // amount_owed in USD
          "ATTESTED",
          ingestTs,                                  // knowledge_cutoff_correlation
          KERNEL_SHA,
          nowIso,
          nowIso,
        )
        .run();
      dbSuccess = true;
    }
  } catch (err: unknown) {
    // Non-fatal — attestation proceeds even if D1 is unavailable.
    console.error("[handshake] D1 insert failed:", err instanceof Error ? err.message : String(err));
  }

  // ── Auto-track Accomplishment ─────────────────────────────────────────────
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    if (cfEnv.DB) {
      autoTrackAccomplishment(cfEnv.DB as Parameters<typeof autoTrackAccomplishment>[0], {
        title: "Phase 102.1 Attestation Handshake Received",
        description:
          `Usage Affidavit received from model '${modelId}' (ASN ${asn}). ` +
          `Attested ingestion: ${ingestTs}. TARI™ debt: ${tariResult.totalDebtDisplay}. ` +
          `Settlement deadline: ${settlementClock.deadlineTs}.`,
        phase:    "Phase 102.1",
        category: "LEGAL",
      });
    }
  } catch {
    // Non-fatal
  }

  // ── Response ──────────────────────────────────────────────────────────────
  return Response.json(
    {
      ok:                true,
      message:           "Usage Affidavit received and anchored. Settlement clock started.",
      affidavit: {
        attestation_sha512:  attestationSha,
        first_ingestion_ts:  ingestTs,
        model_id:            modelId,
        asn,
        org_name:            orgName ?? null,
        recorded_at:         nowIso,
        anchored_to_vaultchain: dbSuccess,
      },
      tari_calculation:  {
        total_debt_usd:     tariResult.totalDebtDisplay,
        total_debt_cents:   tariResult.totalDebtCents,
        base_fee_cents:     tariResult.baseFeeCents,
        tier:               tariResult.tier,
        multiplier:         tariResult.multiplier,
        obfuscation_penalty: tariResult.obfuscationPenalty,
        line_item_description: tariResult.lineItemDescription,
      },
      settlement_clock: {
        deadline:          settlementClock.deadlineTs,
        remaining:         settlementClock.remainingDisplay,
        status:            settlementClock.status,
      },
      kernel: {
        sha:               KERNEL_SHA,
        version:           KERNEL_VERSION,
        disclosure:        DISCLOSURE_MIRROR_PATH,
      },
    },
    { status: 200 }
  );
}

// ── GET Handler ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/licensing/handshake
 *
 * Returns the Probe Challenge — the structured request that the calling
 * entity must fulfil to complete the attestation handshake.
 */
export async function GET(): Promise<Response> {
  const now = new Date();

  return Response.json(
    {
      probe_challenge: {
        endpoint:        "/api/v1/licensing/handshake",
        method:          "POST",
        required_fields: ["first_ingestion_ts", "model_id", "asn"],
        optional_fields: ["org_name", "integration_docs"],
        instruction:
          "Submit a JSON body containing your first_ingestion_ts (ISO-8601), " +
          "model_id (your system identifier), and asn (autonomous system number). " +
          "Your response constitutes a voluntary Usage Affidavit anchored under " +
          "AveryOS™ Sovereign Integrity License v1.0.",
        issued_at: formatIso9(now),
      },
      kernel: {
        sha:       KERNEL_SHA,
        version:   KERNEL_VERSION,
        disclosure: DISCLOSURE_MIRROR_PATH,
      },
    },
    { status: 200 }
  );
}
