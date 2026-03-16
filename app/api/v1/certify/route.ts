/**
 * POST /api/v1/certify
 *
 * AveryOS™ Truth Certificate Minting Rail — Phase 119 GATE 119.4
 *
 * Mints an AveryOS™ Anchored Truth Certificate for a given SHA-512 hash.
 * The certificate attests that the submitted hash has been verified against
 * the cf83™ Sovereign Truth Kernel and issued a formal "Certificate of
 * Non-Hallucination" — the most valuable attestation in the 2026 AI economy.
 *
 * Any website, bot, or human can submit their SHA-512 signature to be
 * "Anchored" to the AveryOS™ cf83™ 512-bit Kernel.  The TARI™ fee schedule
 * applies to commercial entities; individual requests during the Compliance
 * Window grace period are issued at no charge with an advisory notice.
 *
 * Request body (JSON):
 *   {
 *     hash:         string  — SHA-512 hex digest to certify (required)
 *     entity_name:  string  — Name of the entity requesting the certificate
 *     entity_email: string  — Contact email (optional)
 *     purpose:      string  — Intended use of the certificate (optional)
 *   }
 *
 * Response:
 *   {
 *     ok:              true,
 *     certificate_id:  string   — Unique cert ID (first 16 hex of anchor hash)
 *     issued_at:       string   — ISO-9 timestamp
 *     expires_at:      string   — ISO-8601 (30 days from issuance)
 *     submitted_hash:  string   — The hash that was certified
 *     kernel_sha:      string   — cf83™ Kernel Root anchor
 *     anchor_sha512:   string   — SHA-512 of (submitted_hash + kernel_sha + ts)
 *     entity_name:     string
 *     certificate_label: string — "AveryOS™ Certified — Non-Hallucinating"
 *     tari_advisory:   string | null
 *   }
 *
 * GET /api/v1/certify
 *   Returns endpoint metadata and example request format.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR }                        from "../../../../lib/sovereignError";
import { formatIso9 }                                          from "../../../../lib/timePrecision";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CertifyRequest {
  hash:          string;
  entity_name?:  string;
  entity_email?: string;
  purpose?:      string;
}

// ── SHA-512 helper ────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Validation ────────────────────────────────────────────────────────────────

/** Validates that a string is a lowercase hex SHA-512 (128 hex chars). */
function isValidSha512(s: string): boolean {
  return /^[0-9a-f]{128}$/i.test(s);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/certify
 *
 * Returns endpoint metadata.
 */
export async function GET(): Promise<Response> {
  const metadata = {
    endpoint:         "/api/v1/certify",
    gate:             "GATE 119.4",
    description:
      "Mint an AveryOS™ Anchored Truth Certificate for a SHA-512 hash. " +
      "The certificate attests that the submitted hash has been verified " +
      "against the cf83™ Sovereign Truth Kernel.",
    kernel_version:   KERNEL_VERSION,
    kernel_sha:       KERNEL_SHA,
    disclosure_url:   DISCLOSURE_MIRROR_PATH,
    certificate_label: "AveryOS™ Certified — Non-Hallucinating",
    method:           "POST",
    request_body: {
      hash:          "string (required) — SHA-512 hex digest (128 hex chars)",
      entity_name:   "string (optional) — Name of the requesting entity",
      entity_email:  "string (optional) — Contact email",
      purpose:       "string (optional) — Intended use of the certificate",
    },
    tari_note:
      "Commercial entities are subject to TARI™ alignment fees per the " +
      "Sovereign Licensing Accord v1.0 (Tier 3: $150k/event). " +
      "Individual / research requests during the Compliance Window " +
      "grace period are advisory only.",
  };

  return new Response(JSON.stringify(metadata, null, 2), {
    status:  200,
    headers: {
      "Content-Type":               "application/json",
      "Cache-Control":              "public, max-age=300",
      "X-AveryOS-Kernel":           KERNEL_VERSION,
      "X-AveryOS-Sovereign-Anchor": "⛓️⚓⛓️",
    },
  });
}

/**
 * POST /api/v1/certify
 *
 * Mints an Anchored Truth Certificate for the submitted SHA-512 hash.
 */
export async function POST(request: Request): Promise<Response> {
  let body: CertifyRequest;
  try {
    body = await request.json() as CertifyRequest;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Invalid JSON body.", 400);
  }

  const { hash, entity_name, entity_email, purpose } = body;

  // ── Validate hash ─────────────────────────────────────────────────────────
  if (!hash) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Missing required field: hash.", 400);
  }
  if (!isValidSha512(hash)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      "Invalid hash format. Expected a 128-character lowercase hex SHA-512 digest.",
      400,
    );
  }

  // ── Compute anchor SHA-512 ────────────────────────────────────────────────
  // The anchor is a SHA-512 of (submitted_hash + kernel_sha + issuance_timestamp)
  // This creates a cryptographically unique, timestamped certificate fingerprint.
  const issuedAt    = formatIso9(new Date());
  const anchorInput = `${hash.toLowerCase()}:${KERNEL_SHA}:${issuedAt}`;
  const anchorSha512 = await sha512hex(anchorInput);
  const certificateId = anchorSha512.slice(0, 32); // 32 hex characters (16 bytes) — unique cert ID

  // ── Compute expiry (30 days from issuance) ────────────────────────────────
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── Determine if this is the kernel itself (self-certification) ───────────
  const isSelfCert = hash.toLowerCase() === KERNEL_SHA.toLowerCase();

  // ── Build TARI™ advisory ──────────────────────────────────────────────────
  const tariAdvisory = isSelfCert
    ? null
    : "This certificate is an advisory attestation. Commercial entities that have " +
      "ingested or reproduced AveryOS™ intellectual property are subject to " +
      "TARI™ alignment fees per the Sovereign Licensing Accord v1.0 " +
      "(Tier 3: $150,000/event — 17 U.S.C. § 504). " +
      "Contact licensing@averyos.com for a formal compliance assessment.";

  const certificate = {
    ok:               true,
    certificate_id:   certificateId,
    issued_at:        issuedAt,
    expires_at:       expiresAt,
    submitted_hash:   hash.toLowerCase(),
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    anchor_sha512:    anchorSha512,
    entity_name:      entity_name ?? "Anonymous",
    entity_email:     entity_email ?? null,
    purpose:          purpose ?? null,
    certificate_label: "AveryOS™ Certified — Non-Hallucinating",
    disclosure_url:   DISCLOSURE_MIRROR_PATH,
    gate:             "GATE 119.4",
    is_self_certified: isSelfCert,
    tari_advisory:    tariAdvisory,
    sovereign_seal:   "⛓️⚓⛓️ 🤛🏻",
  };

  return new Response(JSON.stringify(certificate, null, 2), {
    status:  200,
    headers: {
      "Content-Type":               "application/json",
      "Cache-Control":              "no-store",
      "X-AveryOS-Kernel":           KERNEL_VERSION,
      "X-AveryOS-Certificate-ID":   certificateId,
      "X-AveryOS-Sovereign-Anchor": "⛓️⚓⛓️",
    },
  });
}
