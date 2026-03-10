/**
 * POST /api/v1/forensics/dns-probes
 * GET  /api/v1/forensics/dns-probes
 *
 * Phase 98 — DNS Probe Forensics
 *
 * POST: Ingest a DNS probe event.  Called by the DNS Proxy Shield
 *       (scripts/verify-dns.ps1) or edge middleware when anomalous DNS
 *       resolution is detected for averyos.com sub-domains.
 *
 *       Request body:
 *         {
 *           "domain":      string   — FQDN that was probed
 *           "resolver_ip": string   — IP of the DNS resolver
 *           "asn":         string?  — ASN of the resolver
 *           "org_name":    string?  — Organisation name
 *           "record_type": string?  — "A" | "AAAA" | "MX" | "TXT" | "CNAME"
 *           "resolved_to": string?  — IP or value returned by the resolver
 *           "expected":    string?  — expected IP/value for drift detection
 *           "is_drift":    boolean  — true if resolved_to ≠ expected
 *           "ray_id":      string?  — Cloudflare RayID (if available)
 *         }
 *
 * GET: List recent DNS probe events.  Auth required.
 *       Query params:
 *         ?limit=<number>       — max rows (default 50, max 200)
 *         ?drift_only=<boolean> — only return drift events
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE for both methods.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

// ── Cloudflare env interface ──────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:               D1Database;
  VAULT_PASSPHRASE?: string;
}

// ── Bootstrap SQL ─────────────────────────────────────────────────────────────

const BOOTSTRAP_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dns_probes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    domain        TEXT    NOT NULL,
    resolver_ip   TEXT    NOT NULL,
    asn           TEXT,
    org_name      TEXT,
    record_type   TEXT    NOT NULL DEFAULT 'A',
    resolved_to   TEXT,
    expected      TEXT,
    is_drift      INTEGER NOT NULL DEFAULT 0,
    ray_id        TEXT,
    kernel_sha    TEXT    NOT NULL,
    kernel_version TEXT   NOT NULL DEFAULT 'v3.6.2',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dns_probes_domain     ON dns_probes (domain)`,
  `CREATE INDEX IF NOT EXISTS idx_dns_probes_is_drift   ON dns_probes (is_drift)`,
  `CREATE INDEX IF NOT EXISTS idx_dns_probes_created_at ON dns_probes (created_at)`,
];

// ── Auth helper ───────────────────────────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aB = new TextEncoder().encode(a);
  const bB = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aB.length; i++) diff |= aB[i] ^ bB[i];
  return diff === 0;
}

function checkAuth(request: Request, passphrase: string): boolean {
  const auth   = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return !!passphrase && safeEqual(bearer, passphrase);
}

// ── POST — ingest a DNS probe event ──────────────────────────────────────────

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  if (!checkAuth(request, cfEnv.VAULT_PASSPHRASE ?? "")) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Unauthorized.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding (DB) is not configured.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const domain     = typeof body.domain      === "string" ? body.domain.trim()      : "";
  const resolverIp = typeof body.resolver_ip === "string" ? body.resolver_ip.trim() : "";

  if (!domain)     return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "'domain' is required.");
  if (!resolverIp) return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "'resolver_ip' is required.");

  const recordType = typeof body.record_type === "string" ? body.record_type.toUpperCase().slice(0, 8) : "A";
  const resolvedTo = typeof body.resolved_to === "string" ? body.resolved_to.slice(0, 255) : null;
  const expected   = typeof body.expected    === "string" ? body.expected.slice(0, 255)    : null;
  const isDrift    = body.is_drift === true || body.is_drift === 1 ? 1 : 0;
  const asn        = typeof body.asn      === "string" ? body.asn.slice(0, 32)      : null;
  const orgName    = typeof body.org_name === "string" ? body.org_name.slice(0, 128) : null;
  const rayId      = typeof body.ray_id   === "string" ? body.ray_id.slice(0, 64)    : null;

  // Bootstrap table on first use
  for (const stmt of BOOTSTRAP_STATEMENTS) {
    try { await cfEnv.DB.prepare(stmt).run(); } catch (bootstrapErr) {
      // Only suppress "table already exists" errors; log anything unexpected
      const msg = bootstrapErr instanceof Error ? bootstrapErr.message : String(bootstrapErr);
      if (!msg.includes("already exists") && !msg.includes("duplicate")) {
        console.warn("[DNS_PROBES] Bootstrap statement failed:", msg);
      }
    }
  }

  try {
    await cfEnv.DB.prepare(
      `INSERT INTO dns_probes
         (domain, resolver_ip, asn, org_name, record_type, resolved_to,
          expected, is_drift, ray_id, kernel_sha, kernel_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      domain, resolverIp, asn, orgName, recordType,
      resolvedTo, expected, isDrift, rayId,
      KERNEL_SHA, KERNEL_VERSION,
    ).run();
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      err instanceof Error ? err.message : "Failed to insert DNS probe record",
    );
  }

  return Response.json({
    status:           "DNS_PROBE_INGESTED",
    domain,
    resolver_ip:      resolverIp,
    record_type:      recordType,
    is_drift:         isDrift === 1,
    kernel_sha_short: KERNEL_SHA.slice(0, 16),
    kernel_version:   KERNEL_VERSION,
    timestamp:        formatIso9(),
  }, { status: 201 });
}

// ── GET — list recent DNS probe events ───────────────────────────────────────

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  if (!checkAuth(request, cfEnv.VAULT_PASSPHRASE ?? "")) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Unauthorized.");
  }

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding (DB) is not configured.");
  }

  const url       = new URL(request.url);
  const rawLimit  = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit     = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
  const driftOnly = url.searchParams.get("drift_only") === "true";

  const sql = driftOnly
    ? `SELECT id, domain, resolver_ip, asn, org_name, record_type, resolved_to,
              expected, is_drift, ray_id, kernel_version, created_at
       FROM   dns_probes
       WHERE  is_drift = 1
       ORDER BY created_at DESC
       LIMIT ?`
    : `SELECT id, domain, resolver_ip, asn, org_name, record_type, resolved_to,
              expected, is_drift, ray_id, kernel_version, created_at
       FROM   dns_probes
       ORDER BY created_at DESC
       LIMIT ?`;

  try {
    const { results } = await cfEnv.DB.prepare(sql).bind(limit).all<Record<string, unknown>>();

    return Response.json({
      status:           "OK",
      count:            results.length,
      drift_only:       driftOnly,
      probes:           results,
      kernel_sha_short: KERNEL_SHA.slice(0, 16),
      kernel_version:   KERNEL_VERSION,
      timestamp:        formatIso9(),
    });
  } catch (err: unknown) {
    return aosErrorResponse(
      AOS_ERROR.DB_QUERY_FAILED,
      err instanceof Error ? err.message : "DNS probe query failed",
    );
  }
}
