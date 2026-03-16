import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

/**
 * GET /api/v1/cron/package-evidence
 *
 * Cloudflare Cron Trigger endpoint — Evidence Packaging Automation (Phase 82).
 * Invoked every 5 minutes by the Cloudflare Cron Trigger defined in wrangler.toml.
 * Also callable manually with a valid VAULT_PASSPHRASE Bearer token.
 *
 * Workflow:
 *   1. Fetch up to 50 unpackaged LEGAL_SCAN events from D1 sovereign_audit_logs.
 *   2. For each event, build a forensic JSON bundle anchored to KERNEL_SHA.
 *   3. Store bundle in R2 VAULT_R2 under evidence/<sha512>.json.
 *   4. Anchor the bundle SHA-512 in anchor_audit_logs.
 *   5. Auto-track as a FORENSIC accomplishment.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface D1PreparedStatement {
  bind(...args: unknown[]): { run(): Promise<unknown> };
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: ReturnType<D1Database["prepare"]>[]): Promise<unknown[]>;
}

interface R2Bucket {
  put(key: string, value: string, opts?: object): Promise<void>;
}

interface CloudflareEnv {
  DB: D1Database;
  VAULT_R2: R2Bucket;
  VAULT_PASSPHRASE?: string;
}

interface AuditLogRow {
  id: number;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  geo_location: string | null;
  target_path: string | null;
  timestamp_ns: string;
  threat_level: number | null;
}

const PACKAGE_LIMIT = 50;

/** Constant-time string comparison to prevent timing attacks. */
/** Compute SHA-512 fingerprint of an evidence bundle. */
async function sha512Of(payload: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Build a canonical forensic evidence bundle for a LEGAL_SCAN event. */
async function buildBundle(row: AuditLogRow, siteUrl: string): Promise<{
  bundleId: string;
  sha512: string;
  r2Key: string;
  content: string;
}> {
  const now      = formatIso9(new Date());
  const bundleId = `EVIDENCE_BUNDLE_${row.id}_${Date.now()}`;
  const bundle   = {
    CapsuleID:       bundleId,
    CapsuleType:     "LEGAL_SCAN_EVIDENCE",
    EventType:       row.event_type,
    EventId:         row.id,
    TargetIP:        row.ip_address ?? "UNKNOWN",
    UserAgent:       row.user_agent ?? "UNKNOWN",
    GeoLocation:     row.geo_location ?? "UNKNOWN",
    TargetPath:      row.target_path ?? "/",
    ThreatLevel:     row.threat_level ?? 10,
    TimestampNs:     row.timestamp_ns,
    PackagedAt:      now,
    KernelAnchor:    KERNEL_SHA,
    KernelVersion:   KERNEL_VERSION,
    SovereignAnchor: "⛓️⚓⛓️",
    CreatorLock:     "🤛🏻 Jason Lee Avery (ROOT0)",
    LicenseUrl:      `${siteUrl}/licensing`,
  };
  const content = JSON.stringify(bundle, null, 2);
  const sha512  = await sha512Of(content);
  const r2Key   = `evidence/${sha512}.json`;
  return { bundleId, sha512, r2Key, content };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // Auth: Bearer token or Cloudflare Cron header (CF-Worker: true)
    const isCronCall  = request.headers.get("cf-worker") === "true";
    const authHeader  = request.headers.get("authorization") ?? "";
    const vaultPass   = cfEnv.VAULT_PASSPHRASE ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isAuthorized = isCronCall || (vaultPass && safeEqual(bearerToken, vaultPass));

    if (!isAuthorized) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Bearer token required.");
    }

    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "D1 DB binding is not configured.");
    }

    if (!cfEnv.VAULT_R2) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "VAULT_R2 R2 binding is not configured.");
    }

    const siteUrl = new URL(request.url).origin;

    // 1. Fetch unpackaged LEGAL_SCAN events
    interface D1Row {
      id: number;
      event_type: string;
      ip_address: string | null;
      user_agent: string | null;
      geo_location: string | null;
      target_path: string | null;
      timestamp_ns: string;
      threat_level: number | null;
    }
    const rows = await (cfEnv.DB
      .prepare(
        `SELECT id, event_type, ip_address, user_agent, geo_location,
                target_path, timestamp_ns, threat_level
         FROM sovereign_audit_logs
         WHERE event_type = 'LEGAL_SCAN'
           AND id NOT IN (
             SELECT DISTINCT CAST(
               CASE WHEN SUBSTR(event_type, 1, 11) = 'LEGAL_SCAN_'
                    THEN SUBSTR(event_type, 12)
                    ELSE '0'
               END AS INTEGER
             )
             FROM anchor_audit_logs
             WHERE event_type LIKE 'LEGAL_SCAN_%'
               AND SUBSTR(event_type, 12) GLOB '[0-9]*'
           )
         ORDER BY id DESC
         LIMIT ?`
      )
      .bind(PACKAGE_LIMIT) as unknown as { all<T>(): Promise<{ results: T[] }> })
      .all<D1Row>()
      .then(r => r.results as AuditLogRow[]);

    const results: Array<{ event_id: number; bundle_id: string; sha512: string; r2_key: string }> = [];
    let failed = 0;

    // 2–5. Package each event
    for (const row of rows) {
      try {
        const { bundleId, sha512, r2Key, content } = await buildBundle(row, siteUrl);

        // Store in R2
        await cfEnv.VAULT_R2.put(r2Key, content, { httpMetadata: { contentType: "application/json" } });

        // Anchor in anchor_audit_logs
        await (cfEnv.DB.prepare(
          `INSERT OR IGNORE INTO anchor_audit_logs
             (anchored_at, sha512, event_type, kernel_sha, timestamp, ray_id, ip_address, path, asn)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          new Date().toISOString(),
          sha512,
          `LEGAL_SCAN_${row.id}`,
          KERNEL_SHA.slice(0, 32) + "…",
          new Date().toISOString(),
          bundleId,
          row.ip_address ?? "UNKNOWN",
          row.target_path ?? "/",
          row.geo_location ?? "UNKNOWN",
        ) as unknown as { run(): Promise<unknown> }).run();

        // Auto-track
        autoTrackAccomplishment(cfEnv.DB as unknown as Parameters<typeof autoTrackAccomplishment>[0], {
          title:       `LEGAL_SCAN Evidence Packaged — Event #${row.id}`,
          description: `Forensic bundle ${bundleId} stored at R2 ${r2Key}. IP: ${row.ip_address ?? "UNKNOWN"}.`,
          category:    "FORENSIC",
          phase:       "Phase 82",
          bundle_id:   bundleId,
        });

        results.push({ event_id: row.id, bundle_id: bundleId, sha512, r2_key: r2Key });
      } catch {
        failed++;
      }
    }

    return Response.json({
      status:         "EVIDENCE_PACKAGING_COMPLETE",
      packaged:       results.length,
      failed,
      total_fetched:  rows.length,
      results,
      kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",
      kernel_version: KERNEL_VERSION,
      packaged_at:    new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
