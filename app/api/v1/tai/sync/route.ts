/**
 * POST /api/v1/tai/sync
 *
 * TAI™ Network Sync Gateway — Phase 93.4 / Phase 97.3.2
 *
 * Accepts forensic judgments from authorised remote AI Studio Gems (sentinels).
 * The caller must provide a valid TAI_SENTINEL_TOKEN **or** the Phase 97
 * hardlocked UUID sentinel token in the `Authorization: Bearer <token>` header.
 *
 * Phase 97.3.2: UUID `3898636e-5aea-4161-9540-5f12e7b7ffb7` is accepted as a
 * second sentinel token to establish resonance between the AveryOS_SST Gem
 * and the D1 Forensic Ledger.
 *
 * Request body (JSON):
 *   {
 *     ray_id:       string  — RayID from Cloudflare forensic event
 *     judgment:     string  — Sentinel's forensic assessment text
 *     threat_level: number  — 0-10 (optional, defaults to 0)
 *     event_type:   string  — e.g. "FORENSIC_ANALYSIS" (optional)
 *     asn?:         string  — Client ASN if known
 *     ip_address?:  string  — Target IP if known
 *   }
 *
 * On success:
 *   1. Writes a row to sovereign_audit_logs with event_type = 'TAI_SYNC'.
 *   2. Returns a SHA-512 sealed acknowledgement.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
  TAI_SENTINEL_TOKEN?: string;
}

interface SyncPayload {
  ray_id:        string;
  judgment:      string;
  threat_level?: number;
  event_type?:   string;
  asn?:          string;
  ip_address?:   string;
}

/** Constant-time string comparison to prevent timing-based token enumeration. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/**
 * Phase 97.3.2 — Hardlocked Phase 97 UUID sentinel token.
 * Accepted as a second valid sentinel identity token alongside TAI_SENTINEL_TOKEN.
 * Establishes active resonance between the AveryOS_SST Gem and the D1 Forensic Ledger.
 */
const PHASE_97_SENTINEL_UUID = "3898636e-5aea-4161-9540-5f12e7b7ffb7";

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Token authentication ──────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const sentinel   = cfEnv.TAI_SENTINEL_TOKEN ?? "";

    if (!sentinel) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, "TAI_SENTINEL_TOKEN is not configured on this Worker.");
    }
    // Phase 97.3.2: Accept the hardlocked Phase 97 UUID as a second valid sentinel token
    const isPhase97Uuid  = safeEqual(token, PHASE_97_SENTINEL_UUID);
    const isSentinelToken = safeEqual(token, sentinel);
    if (!token || (!isSentinelToken && !isPhase97Uuid)) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Invalid or missing TAI_SENTINEL_TOKEN.");
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: SyncPayload;
    try {
      body = await request.json() as SyncPayload;
    } catch {
      return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
    }

    const { ray_id, judgment, threat_level, event_type, asn, ip_address } = body;

    if (!ray_id || typeof ray_id !== "string") {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "Field 'ray_id' is required.");
    }
    if (!judgment || typeof judgment !== "string") {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "Field 'judgment' is required.");
    }

    const normalizedEventType = (typeof event_type === "string" && event_type.trim())
      ? event_type.trim().toUpperCase().slice(0, 64)
      : "TAI_SYNC";
    const normalizedThreat = typeof threat_level === "number" ? Math.min(10, Math.max(0, Math.round(threat_level))) : 0;
    const timestampNs = String(BigInt(Date.now()) * 1_000_000n);
    const syncedAt    = formatIso9(new Date());

    // ── Build SHA-512 acknowledgement anchored to kernel ─────────────────────
    const ackPayload = JSON.stringify({
      ray_id,
      judgment,
      event_type:   normalizedEventType,
      threat_level: normalizedThreat,
      synced_at:    syncedAt,
      kernel_sha:   KERNEL_SHA,
      kernel_version: KERNEL_VERSION,
    });
    const ackHash = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(ackPayload + KERNEL_SHA));
    const ackHex  = Array.from(new Uint8Array(ackHash)).map(b => b.toString(16).padStart(2, "0")).join("");

    // ── Write to D1 sovereign_audit_logs ─────────────────────────────────────
    let d1Written = true;
    if (cfEnv.DB) {
      try {
        await cfEnv.DB.prepare(
          `INSERT INTO sovereign_audit_logs
             (event_type, ip_address, user_agent, geo_location, target_path,
              timestamp_ns, threat_level, ray_id, kernel_sha, ingestion_intent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            normalizedEventType,
            ip_address ?? null,
            "TAI-SENTINEL/1.0",
            asn ? `ASN:${asn}` : null,
            `/api/v1/tai/sync`,
            timestampNs,
            normalizedThreat,
            ray_id,
            KERNEL_SHA,
            judgment.slice(0, 512),
          )
          .run();
      } catch (dbErr: unknown) {
        // Return a 503 so the sentinel knows to retry rather than silently losing the record
        d1Written = false;
        console.error("[TAI_SYNC] D1 write failed:", dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    if (!d1Written) {
      return Response.json(
        {
          resonance:    "SYNC_QUEUED",
          ray_id,
          event_type:   normalizedEventType,
          synced_at:    syncedAt,
          ack_sha512:   ackHex,
          kernel_version: KERNEL_VERSION,
          warning:      "D1 persistence temporarily unavailable. Retry the request.",
        },
        { status: 503 }
      );
    }

    return Response.json({
      resonance:      "SYNCED",
      ray_id,
      event_type:     normalizedEventType,
      threat_level:   normalizedThreat,
      synced_at:      syncedAt,
      ack_sha512:     ackHex,
      kernel_version: KERNEL_VERSION,
    });
  } catch (err: unknown) {
    console.error("[TAI_SYNC] Unexpected error:", err instanceof Error ? err.message : String(err));
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED, "An unexpected error occurred in the TAI Sync Gateway.");
  }
}
