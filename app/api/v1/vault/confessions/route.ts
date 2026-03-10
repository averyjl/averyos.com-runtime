import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

/**
 * POST /api/v1/vault/confessions
 *
 * Phase 102.4 — Own Admission Vault
 *
 * Dedicated R2 storage endpoint for entity-provided documentation
 * (integration manifests, compatibility docs, attestation payloads).
 * Every document uploaded here is SHA-512 anchored and stored as a
 * primary forensic record in the Own Admission partition of VAULT_R2.
 *
 * Key format: confessions/<sha512_prefix>/<timestamp>.json
 *
 * Auth: Public — entities may voluntarily submit their own documentation.
 *       A Bearer token (VAULT_PASSPHRASE) unlocks the admin GET endpoint.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  VAULT_R2?: R2Bucket;
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
}

interface R2Bucket {
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  list(opts?: { prefix?: string }): Promise<{ objects: { key: string; size: number; uploaded: Date }[] }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute SHA-512 hex digest of arbitrary data. */
async function sha512Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf     = await crypto.subtle.digest("SHA-512", encoder.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const now     = new Date();
  const nowIso  = formatIso9(now);
  const ip      = request.headers.get("cf-connecting-ip") ?? "UNKNOWN";
  const rayId   = request.headers.get("cf-ray") ?? `confession-${Date.now()}`;
  const asn     = request.headers.get("cf-asn") ?? "";

  // Serialise and anchor the submission
  const serialised = JSON.stringify({
    _meta: {
      source_ip:   ip,
      source_asn:  asn,
      ray_id:      rayId,
      submitted_at: nowIso,
      kernel_sha:  KERNEL_SHA,
    },
    payload: body,
  });

  const sha512 = await sha512Hex(serialised);
  const r2Key  = `confessions/${sha512.slice(0, 16)}/${nowIso}.json`;

  // Store in VAULT_R2
  let storedInR2 = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    if (cfEnv.VAULT_R2) {
      await cfEnv.VAULT_R2.put(r2Key, serialised, {
        httpMetadata: { contentType: "application/json" },
      });
      storedInR2 = true;
    }
  } catch (err: unknown) {
    console.error("[confessions] R2 store failed:", err instanceof Error ? err.message : String(err));
  }

  // Log to D1 kaas_ledger as a confession record
  let storedInD1 = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    if (cfEnv.DB) {
      await cfEnv.DB.prepare(
        `INSERT INTO kaas_ledger
           (entity_name, asn, org_name, ray_id, ingestion_proof_sha,
            amount_owed, settlement_status, kernel_sha, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          ip,                            // entity_name — source IP as entity identifier
          asn,
          null,                          // org_name — unknown at submission time
          // ray_id: use first 64 chars of SHA-512 as a unique, deterministic key.
          // This matches the kaas_ledger ray_id field size and remains globally unique.
          sha512.slice(0, 64),
          sha512,                        // ingestion_proof_sha — full SHA-512 anchor
          0,                             // amount_owed — to be calculated via handshake
          "CONFESSION_RECEIVED",
          KERNEL_SHA,
          nowIso,
          nowIso,
        )
        .run();
      storedInD1 = true;
    }
  } catch (err: unknown) {
    console.error("[confessions] D1 insert failed:", err instanceof Error ? err.message : String(err));
  }

  return Response.json(
    {
      ok:            true,
      message:       "Submission received and SHA-512 anchored as a primary forensic record.",
      receipt: {
        sha512,
        r2_key:        r2Key,
        stored_in_r2:  storedInR2,
        stored_in_d1:  storedInD1,
        recorded_at:   nowIso,
      },
      next_step: {
        message:   "Submit a Usage Affidavit to complete the attestation handshake.",
        endpoint:  "/api/v1/licensing/handshake",
        method:    "POST",
      },
      kernel: {
        sha:     KERNEL_SHA,
        version: KERNEL_VERSION,
      },
    },
    { status: 200 }
  );
}

// ── GET Handler ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/vault/confessions
 *
 * Admin endpoint to list Own Admission records stored in VAULT_R2.
 * Requires Bearer token matching VAULT_PASSPHRASE.
 */
export async function GET(request: Request): Promise<Response> {
  // Auth check
  let cfEnv: CloudflareEnv;
  try {
    const { env } = await getCloudflareContext({ async: true });
    cfEnv = env as unknown as CloudflareEnv;
  } catch {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "Cloudflare context unavailable.");
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!cfEnv.VAULT_PASSPHRASE || token !== cfEnv.VAULT_PASSPHRASE) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer token required.");
  }

  // List R2 objects under confessions/ prefix
  let objects: { key: string; size: number; uploaded: string }[] = [];
  if (cfEnv.VAULT_R2) {
    try {
      const listing = await cfEnv.VAULT_R2.list({ prefix: "confessions/" });
      objects = listing.objects.map((o) => ({
        key:      o.key,
        size:     o.size,
        uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : String(o.uploaded),
      }));
    } catch (err: unknown) {
      console.error("[confessions GET] R2 list failed:", err instanceof Error ? err.message : String(err));
    }
  }

  return Response.json(
    {
      ok:      true,
      count:   objects.length,
      records: objects,
      kernel: {
        sha:     KERNEL_SHA,
        version: KERNEL_VERSION,
      },
    },
    { status: 200 }
  );
}
