import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { calculateTariFee } from "../../../../../lib/tari/calculator";
import { startReconciliationClock } from "../../../../../lib/compliance/clockEngine";

/**
 * POST /api/v1/licensing/handshake
 *
 * AveryOS™ Phase 102.1 / Gate 1 — Enterprise License Usage Attestation
 *
 * Accepts a voluntary usage attestation from an entity that wishes to
 * obtain a license for AveryOS™ intellectual property.  The entity
 * provides their organisation details, the date on which they began
 * using AveryOS™ IP, and their intended licensing tier.
 *
 * The endpoint returns:
 *   • A PROBE_CHALLENGE nonce for the entity to echo back (integrity check).
 *   • The calculated TARI™ fee (including a retroactive multiplier when
 *     usage predates the current date by ≥ 1 year).
 *   • A Stripe checkout URL pre-populated with the fee.
 *   • A 72-hour settlement deadline (via clockEngine.ts).
 *
 * The attestation record is persisted in the `kaas_ledger` D1 table so
 * that it can be referenced during subsequent compliance reviews.
 *
 * Auth: public — no Bearer token required.  The IP address and
 * User-Agent of the caller are logged as forensic metadata.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Cloudflare env types ───────────────────────────────────────────────────────

interface CloudflareEnv {
  DB?: D1Database;
  SOVEREIGN_KV?: KVNamespace;
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

interface KVNamespace {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
}

// ── Request body schema ────────────────────────────────────────────────────────

interface HandshakeRequestBody {
  /** Unique identifier for the licensing entity — ASN string, UUID, or domain. */
  entity_id?: string;
  /** Human-readable organisation name. */
  entity_name?: string;
  /**
   * ISO-8601 date/datetime when the entity first used AveryOS™ IP.
   * If this predates the current date by ≥ 1 year, a retroactive multiplier
   * is applied to the base TARI™ fee.
   */
  usage_start_date?: string;
  /** ASN of the requesting network (e.g. "36459"). */
  asn?: string;
  /**
   * Optional SHA-512 / SHA-256 hash the entity provides as a reference
   * to their ingestion manifest or weight snapshot.  Stored as-is for
   * audit purposes; not used in fee calculation.
   */
  ingestion_proof_sha?: string;
  /** Optional free-form description of the intended licensing use. */
  intended_use?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure probe challenge nonce. */
function generateProbeChallenge(): string {
  const ts   = Date.now().toString(16).toUpperCase();
  const buf  = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const rand = (buf[0] * 0x100000000 + buf[1]).toString(16).toUpperCase().slice(-12).padStart(12, "0");
  return `AOS-PROBE-${ts}-${rand}`;
}

/** Sanitise a string field to at most `maxLen` characters. */
function trim(val: unknown, maxLen = 500): string {
  return typeof val === "string" ? val.slice(0, maxLen).trim() : "";
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: HandshakeRequestBody;
  try {
    body = (await request.json()) as HandshakeRequestBody;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const entityName       = trim(body.entity_name)       || "Unknown Entity";
  const entityId         = trim(body.entity_id, 200)    || `ANON-${Date.now()}`;
  const asnStr           = trim(body.asn, 20);
  const usageStartDate   = trim(body.usage_start_date, 50) || null;
  const ingestionSha     = trim(body.ingestion_proof_sha, 200);
  const intendedUse      = trim(body.intended_use, 500);

  // ── TARI fee calculation ────────────────────────────────────────────────────
  const calculation = calculateTariFee({
    asn:           asnStr || "0",
    entityName,
    usageStartDate,
  });

  // ── Probe challenge ─────────────────────────────────────────────────────────
  const probeChallenge = generateProbeChallenge();
  const attestedAt     = formatIso9();

  // ── Persist attestation record in D1 ───────────────────────────────────────
  const { env } = await getCloudflareContext() as unknown as { env: CloudflareEnv };

  if (env.DB) {
    try {
      await env.DB
        .prepare(
          `INSERT INTO kaas_ledger
             (entity_name, asn, org_name, ray_id, ingestion_proof_sha,
              amount_owed, settlement_status, knowledge_cutoff_correlation,
              kernel_sha, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          entityName,
          asnStr || null,
          entityName,
          probeChallenge,
          ingestionSha || null,
          calculation.totalFeeUsd,
          "OPEN",
          [
            usageStartDate   ? `usage_start=${usageStartDate};prior_days=${calculation.priorUsageDays}` : null,
            intendedUse      ? `intended_use=${intendedUse}` : null,
          ].filter(Boolean).join(";") || null,
          KERNEL_SHA,
          attestedAt,
          attestedAt,
        )
        .run();
    } catch (dbErr) {
      console.error("[handshake] D1 insert failed:", dbErr instanceof Error ? dbErr.message : String(dbErr));
      // Non-fatal — continue even if D1 write fails
    }
  }

  // ── Start 72-hour settlement clock ─────────────────────────────────────────
  const clock = await startReconciliationClock(
    entityId,
    env.SOVEREIGN_KV ?? null,
  );

  // ── Auto-track accomplishment ───────────────────────────────────────────────
  if (env.DB) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await autoTrackAccomplishment(env.DB as any, {
        title:       `Licensing Handshake — ${entityName}`,
        description: `Usage attestation received from ${entityName} (${asnStr || "no ASN"}). ` +
                     `Total fee: ${calculation.totalFeeLabel}. ` +
                     `Settlement deadline: ${clock.deadlineAt}.`,
        category:    "LEGAL",
        bundle_id:   probeChallenge,
        asn:         asnStr || undefined,
      });
    } catch {
      // Non-fatal
    }
  }

  // ── Build checkout URL ──────────────────────────────────────────────────────
  const siteUrl = env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
  const checkoutParams = new URLSearchParams({
    asn:        asnStr || "",
    ray_id:     probeChallenge,
    bundle_id:  probeChallenge,
    entity:     entityName.slice(0, 100),
  });

  return Response.json(
    {
      // Challenge nonce the entity should echo back on payment
      probe_challenge:      probeChallenge,
      attested_at:          attestedAt,

      // Fee calculation
      tari_fee_usd:         calculation.totalFeeUsd,
      tari_fee_label:       calculation.totalFeeLabel,
      base_fee_usd:         calculation.baseFeeUsd,
      retroactive_multiplier: calculation.retroactiveMultiplier,
      prior_usage_days:     calculation.priorUsageDays,
      asn_tier:             calculation.tier,

      // Settlement window
      settlement_deadline:  clock.deadlineAt,
      settlement_hours:     clock.windowHours,

      // Stripe checkout
      checkout_url: `${siteUrl}/api/v1/compliance/create-checkout?${checkoutParams.toString()}`,

      // Kernel anchor
      kernel_version: KERNEL_VERSION,
      kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",

      // Sovereign disclosure
      disclosure: `By submitting this attestation you acknowledge the AveryOS™ ` +
                  `Sovereign Integrity License v1.0. Your submission is recorded ` +
                  `as a voluntary usage disclosure for licensing purposes. ` +
                  `Full terms: ${siteUrl}/licensing/enterprise`,
    },
    { status: 200 },
  );
}

// ── GET: return probe challenge without persisting ─────────────────────────────

export async function GET(): Promise<Response> {
  const probeChallenge = generateProbeChallenge();
  return Response.json(
    {
      probe_challenge: probeChallenge,
      message:
        "POST to this endpoint with your entity details to receive a TARI™ fee quote " +
        "and a 72-hour settlement deadline. " +
        "See the AveryOS™ Sovereign Integrity License v1.0 for licensing terms.",
      required_fields: [
        "entity_id",
        "entity_name",
        "asn",
        "usage_start_date",
      ],
      optional_fields: [
        "ingestion_proof_sha",
        "intended_use",
      ],
      kernel_version: KERNEL_VERSION,
    },
    { status: 200 },
  );
}
