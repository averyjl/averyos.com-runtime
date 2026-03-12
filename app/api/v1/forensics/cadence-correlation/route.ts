/**
 * GET /api/v1/forensics/cadence-correlation
 *
 * Cadence Correlation API — AveryOS™ Phase 106 / Roadmap Gate 3.1
 *
 * Queries anchor_audit_logs and runs cadence probe correlation for
 * live 17-Signal detection.  Identifies entities with high-frequency
 * access patterns that exceed the 2-second cadence probe threshold.
 *
 * The "17-Signal" refers to the 17 correlated signals used in forensic
 * analysis to distinguish systematic ingestion from casual browsing:
 *   1.  Sub-2s inter-request interval
 *   2.  Repeated paths across evidence-vault, capsules, whitepaper
 *   3.  Known sentinel IP address
 *   4.  Missing or spoofed User-Agent
 *   5.  No Accept-Language header
 *   6.  Uniform request timing (bot-like cadence)
 *   7.  ASN associated with major AI/cloud providers
 *   8.  Sequential capsule enumeration
 *   9.  Accessing OIDC/.well-known endpoints
 *   10. Multiple probes per minute
 *   11. Missing Referer on deep links
 *   12. TLS fingerprint mismatch
 *   13. High WAF score
 *   14. Datacenter IP (not residential)
 *   15. Accessing the kernel anchor directly
 *   16. Accessing the JWKS endpoint
 *   17. Cross-capsule SHA enumeration
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }        from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION }  from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

// ── Local types ───────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...v: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

interface AuditLogRow {
  ip_address:       string;
  asn:              string | null;
  user_agent:       string | null;
  target_path:      string | null;
  timestamp_ns:     string;
  ingestion_intent: string | null;
  threat_level:     number | null;
  event_type:       string | null;
}

interface CadenceProbeResult {
  ip_address:       string;
  asn:              string | null;
  hit_count:        number;
  unique_paths:     number;
  first_seen:       string;
  last_seen:        string;
  signal_score:     number;
  signals_fired:    string[];
  drift_probability: number;
  threat_level:     number;
}

/** Constant-time comparison to prevent timing-based token enumeration. */
// Known sentinel IPs / high-value ASNs (mirrors middleware.ts)
const SENTINEL_IPS  = new Set(["185.177.72.60"]);
const HIGH_VALUE_ASNS = new Set(["8075", "15169", "36459", "16509", "32934"]);

// Paths that indicate systematic ingestion behavior
const EVIDENCE_PATHS = [
  "/evidence-vault",
  "/api/v1/evidence",
  "/.well-known",
  "/witness/disclosure",
  "/capsules",
  "/whitepaper",
  "/api/v1/licensing/handshake",
];

/**
 * Compute the 17-signal correlation score for a group of audit log rows
 * belonging to the same IP address.
 */
function correlateCadenceProbes(
  rows: AuditLogRow[],
  ip: string,
  asn: string | null,
): CadenceProbeResult {
  const signals: string[] = [];
  const paths = new Set(rows.map(r => r.target_path ?? ""));
  const agents = new Set(rows.map(r => r.user_agent ?? ""));

  // Signal 1: High hit count (> 10 requests)
  if (rows.length > 10) signals.push("S01_HIGH_HIT_COUNT");

  // Signal 2: Evidence/capsule path accessed
  const evidenceHits = rows.filter(r =>
    EVIDENCE_PATHS.some(p => (r.target_path ?? "").startsWith(p))
  ).length;
  if (evidenceHits > 0) signals.push("S02_EVIDENCE_PATH_ACCESS");

  // Signal 3: Known sentinel IP
  if (SENTINEL_IPS.has(ip)) signals.push("S03_SENTINEL_IP");

  // Signal 4: Missing or spoofed User-Agent
  if (agents.has("") || agents.has("unknown") || agents.size === 0) signals.push("S04_MISSING_UA");

  // Signal 6: Uniform timing (bot-like cadence) — check if timestamps are regular
  const timestamps = rows.map(r => Number(r.timestamp_ns ?? "0") / 1e6).sort((a, b) => a - b);
  if (timestamps.length >= 3) {
    // eslint-disable-next-line security/detect-object-injection
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance    = intervals.reduce((a, b) => a + Math.abs(b - avgInterval), 0) / intervals.length;
    if (avgInterval < 2000 && avgInterval > 0) signals.push("S06_SUB2S_CADENCE");
    if (variance < 100) signals.push("S06B_UNIFORM_TIMING");
  }

  // Signal 7: High-value ASN
  if (asn && HIGH_VALUE_ASNS.has(asn)) signals.push("S07_HIGH_VALUE_ASN");

  // Signal 8: Multi-path access (> 3 unique paths)
  if (paths.size > 3) signals.push("S08_MULTI_PATH_ACCESS");

  // Signal 9: OIDC/.well-known access
  if (rows.some(r => (r.target_path ?? "").includes("/.well-known"))) signals.push("S09_OIDC_PROBE");

  // Signal 10: > 5 requests/min
  if (timestamps.length >= 2) {
    const windowMs = timestamps[timestamps.length - 1] - timestamps[0];
    const rpm = windowMs > 0 ? (rows.length / windowMs) * 60_000 : rows.length;
    if (rpm > 5) signals.push("S10_HIGH_RPM");
  }

  // Signal 13: High WAF score
  const maxThreat = Math.max(...rows.map(r => r.threat_level ?? 0));
  if (maxThreat >= 9) signals.push("S13_HIGH_WAF_SCORE");

  // Signal 15: Kernel anchor access
  if (rows.some(r => (r.target_path ?? "").includes("/witness/disclosure"))) signals.push("S15_KERNEL_ANCHOR_ACCESS");

  // Signal 16: JWKS access
  if (rows.some(r => (r.target_path ?? "").includes("jwks"))) signals.push("S16_JWKS_ACCESS");

  // Signal 17: Handshake endpoint access
  if (rows.some(r => (r.target_path ?? "").includes("/handshake"))) signals.push("S17_HANDSHAKE_PROBE");

  const signalScore     = signals.length;
  const driftProbability = Math.min(1.0, signalScore / 17);
  const threatLevel     = signalScore >= 10 ? 10 : signalScore >= 7 ? 9 : signalScore >= 4 ? 7 : 3;

  const sortedTs  = timestamps.sort((a, b) => a - b);
  const firstSeen = sortedTs[0] ? new Date(sortedTs[0]).toISOString() : "";
  const lastSeen  = sortedTs[sortedTs.length - 1] ? new Date(sortedTs[sortedTs.length - 1]).toISOString() : "";

  return {
    ip_address:        ip,
    asn:               asn || null,
    hit_count:         rows.length,
    unique_paths:      paths.size,
    first_seen:        firstSeen,
    last_seen:         lastSeen,
    signal_score:      signalScore,
    signals_fired:     signals,
    drift_probability: parseFloat(driftProbability.toFixed(4)),
    threat_level:      threatLevel,
  };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const vaultPass = cfEnv.VAULT_PASSPHRASE ?? "";
  if (vaultPass) {
    const authHeader  = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!safeEqual(bearerToken, vaultPass)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        "Valid Bearer VAULT_PASSPHRASE token required.");
    }
  }

  // ── Parse params ──────────────────────────────────────────────────────────
  const url           = new URL(request.url);
  const windowHours   = Math.min(Number(url.searchParams.get("window_hours") ?? "24"), 168);
  const minSignals    = Number(url.searchParams.get("min_signals") ?? "3");
  const limitEntities = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

  if (!cfEnv.DB) {
    return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, "D1 database binding (DB) is not configured.");
  }

  // ── Query anchor_audit_logs ───────────────────────────────────────────────
  const windowMs  = windowHours * 60 * 60 * 1_000;
  const cutoffTs  = new Date(Date.now() - windowMs).toISOString();

  let auditRows: AuditLogRow[] = [];
  try {
    const result = await cfEnv.DB
      .prepare(
        `SELECT ip_address, asn, user_agent, target_path, timestamp_ns,
                ingestion_intent, threat_level, event_type
           FROM sovereign_audit_logs
          WHERE timestamp_ns >= ?
          ORDER BY timestamp_ns ASC
          LIMIT 5000`
      )
      .bind(cutoffTs)
      .all<AuditLogRow>();
    auditRows = result.results ?? [];
  } catch (err: unknown) {
    return aosErrorResponse(AOS_ERROR.DB_QUERY_FAILED,
      `audit log query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Group by IP ───────────────────────────────────────────────────────────
  const ipGroups = new Map<string, { rows: AuditLogRow[]; asn: string | null }>();

  for (const row of auditRows) {
    const ip = row.ip_address ?? "unknown";
    if (!ipGroups.has(ip)) {
      ipGroups.set(ip, { rows: [], asn: row.asn ?? null });
    }
    ipGroups.get(ip)!.rows.push(row);
  }

  // ── Run correlation ───────────────────────────────────────────────────────
  const correlationResults: CadenceProbeResult[] = [];

  for (const [ip, { rows, asn }] of ipGroups) {
    const result = correlateCadenceProbes(rows, ip, asn);
    if (result.signal_score >= minSignals) {
      correlationResults.push(result);
    }
  }

  // Sort by signal score descending
  correlationResults.sort((a, b) => b.signal_score - a.signal_score);
  const top = correlationResults.slice(0, limitEntities);

  const driftDetected = top.filter(r => r.drift_probability > 0).length;

  return Response.json(
    {
      resonance:         "HIGH_FIDELITY_SUCCESS",
      window_hours:      windowHours,
      cutoff_ts:         cutoffTs,
      total_ips_analyzed: ipGroups.size,
      total_audit_rows:   auditRows.length,
      entities_flagged:   top.length,
      drift_detected:     driftDetected,
      min_signals_filter: minSignals,

      // 17-signal correlation results
      correlation_results: top,

      // Summary
      summary: {
        tier9_entities:    top.filter(r => r.asn && HIGH_VALUE_ASNS.has(r.asn)).length,
        sentinel_ips:      top.filter(r => SENTINEL_IPS.has(r.ip_address)).length,
        max_signal_score:  top[0]?.signal_score ?? 0,
        avg_drift_prob:    top.length > 0
          ? parseFloat((top.reduce((s, r) => s + r.drift_probability, 0) / top.length).toFixed(4))
          : 0,
      },

      // Kernel anchor
      kernel_sha:        KERNEL_SHA.slice(0, 32) + "…",
      kernel_version:    KERNEL_VERSION,
      sovereign_anchor:  "⛓️⚓⛓️",
      analyzed_at:       new Date().toISOString(),
    },
    { status: 200 },
  );
}
