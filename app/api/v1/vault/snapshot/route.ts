/**
 * POST /api/v1/vault/snapshot
 *
 * VaultChain™ Snapshot — AveryOS™ Phase 111 / GATE 111.3
 *
 * Locks the current file channel manifest to R2 as a sovereign snapshot,
 * anchored by the cf83... kernel SHA-512. Each snapshot is stored at:
 *   vault-snapshots/{iso8601}-{kernel_version}.json
 *
 * The snapshot captures:
 *   - Kernel anchor (SHA-512 + version)
 *   - Timestamp (ISO-9 precision)
 *   - Caller IP and ASN (forensic metadata)
 *   - Optional body JSON payload to include in the manifest
 *
 * Auth: Bearer VAULT_PASSPHRASE (constant-time comparison via safeEqual).
 *
 * Body (JSON, optional):
 *   {
 *     "manifest_id": string,   // e.g. "FileChannel2026_LiveRuntimeCapsule"
 *     "entries":     unknown[] // manifest entries to lock
 *   }
 *
 * Response:
 *   200 { snapshot_key, manifest_id, kernel_sha, kernel_version, locked_at, entry_count, pulse_hash }
 *   400 Bad Request
 *   401 Unauthorized
 *   500 Internal Error
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }       from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 }                 from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

// ── Local type interfaces (no @cloudflare/workers-types import) ───────────────

interface R2Bucket {
  put(key: string, value: string, opts?: { httpMetadata?: Record<string, string> }): Promise<void>;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  VAULT_R2?:        R2Bucket;
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

// ── SHA-512 helper ────────────────────────────────────────────────────────────

/** Constant-time string comparison to mitigate timing-side-channel attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc    = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) {
    // Always traverse to maintain constant-time behaviour
    const maxLen = Math.max(aBytes.length, bBytes.length);
    for (let i = 0; i < maxLen; i++) void (aBytes[i] ?? 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    // ── Auth: Bearer VAULT_PASSPHRASE ─────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const expected   = cfEnv.VAULT_PASSPHRASE ?? "";
    if (!expected || !safeEqual(token, expected)) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Valid VAULT_PASSPHRASE Bearer token is required.");
    }

    if (!cfEnv.VAULT_R2) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "VAULT_R2 R2 binding is not configured.");
    }

    // ── Parse optional body ───────────────────────────────────────────────────
    let manifestId = "FileChannel2026_LiveRuntimeCapsule";
    let entries: unknown[] = [];
    try {
      const body = await request.json() as { manifest_id?: string; entries?: unknown[] };
      if (typeof body.manifest_id === "string" && body.manifest_id.trim()) {
        manifestId = body.manifest_id.trim();
      }
      if (Array.isArray(body.entries)) {
        entries = body.entries;
      }
    } catch {
      // Body is optional — empty body is fine
    }

    // ── Build snapshot ────────────────────────────────────────────────────────
    const lockedAt  = formatIso9();
    const ip        = request.headers.get("cf-connecting-ip")
                   ?? request.headers.get("x-forwarded-for")
                   ?? "unknown";
    const asn       = request.headers.get("cf-asn") ?? "unknown";

    // SHA-512 pulse hash anchoring this snapshot to the sovereign kernel
    const pulseInput = [KERNEL_SHA, manifestId, lockedAt, ip, entries.length.toString()].join("|");
    const pulseHash  = await sha512hex(pulseInput);

    const snapshot = {
      schema:          "VaultChain-Snapshot-v1",
      manifest_id:     manifestId,
      vaultchain_uri:  `VaultChain://JasonLeeAvery/${manifestId}.aoscap`,
      kernel_sha:      KERNEL_SHA,
      kernel_version:  KERNEL_VERSION,
      locked_at:       lockedAt,
      entry_count:     entries.length,
      entries,
      forensic: {
        ip,
        asn,
        pulse_hash: pulseHash,
      },
      creator_lock: "🤛🏻",
    };

    // ── Store in R2 ───────────────────────────────────────────────────────────
    // Key: vault-snapshots/{ISO-date}/{manifest_id}.json
    const datePrefix   = lockedAt.slice(0, 10); // YYYY-MM-DD
    const snapshotKey  = `vault-snapshots/${datePrefix}/${manifestId}-${KERNEL_VERSION}.json`;

    await cfEnv.VAULT_R2.put(
      snapshotKey,
      JSON.stringify(snapshot, null, 2),
      { httpMetadata: { contentType: "application/json" } },
    );

    // ── Persist receipt to D1 sovereign_audit_logs (non-blocking) ────────────
    if (cfEnv.DB) {
      cfEnv.DB.prepare(
        `INSERT OR IGNORE INTO sovereign_audit_logs
           (event_type, ip_address, user_agent, target_path, timestamp_ns, threat_level,
            kernel_sha, asn, ingestion_intent, pulse_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          "VAULT_SNAPSHOT_LOCKED",
          ip,
          request.headers.get("user-agent") ?? "unknown",
          "/api/v1/vault/snapshot",
          lockedAt,
          1,
          KERNEL_SHA,
          asn,
          "VAULTCHAIN_PERMANENCE",
          pulseHash,
        )
        .run()
        .catch((err: unknown) => {
          console.warn("[vault/snapshot] D1 audit log failed:", err instanceof Error ? err.message : String(err));
        });
    }

    return Response.json({
      ok:             true,
      snapshot_key:   snapshotKey,
      manifest_id:    manifestId,
      vaultchain_uri: snapshot.vaultchain_uri,
      kernel_sha:     KERNEL_SHA,
      kernel_version: KERNEL_VERSION,
      locked_at:      lockedAt,
      entry_count:    entries.length,
      pulse_hash:     pulseHash,
    });
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.INTERNAL_ERROR,
      err instanceof Error ? err.message : "VaultChain snapshot failed.",
    );
  }
}
