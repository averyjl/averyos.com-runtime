/**
 * GET /api/v1/tari/calculate-fee
 *
 * Phase 86 — AveryOS™ Dynamic TARI™ Pricing API
 *
 * Returns the TARI™ alignment fee for a given request based on its
 * Forensic Depth.  Fee schedule:
 *
 *   Forensic Depth 0 (public viewing)          →  $0.00
 *   Forensic Depth 1 (light probe / crawl)     →  $1,017.00
 *   Forensic Depth 2 (DER-ASN entity scan)     →  $5,000.00
 *   Forensic Depth 3 (WAF-flagged deep probe)  →  $10,000,000.00
 *
 * Query parameters:
 *   asn          — client ASN (used for DER entity detection)
 *   waf_score    — Cloudflare WAF attack score (0–100)
 *   path         — request path being probed
 *   threat_level — override threat level (1–10); computed if omitted
 *
 * Response:
 *   {
 *     "fee_usd":         number
 *     "forensic_depth":  number   (0–3)
 *     "tier":            string   (PUBLIC | LIGHT_PROBE | DER_SCAN | DEEP_PROBE)
 *     "kernel_sha":      string
 *     "calculated_at":   string
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";

// ── Fee schedule ──────────────────────────────────────────────────────────────
const FEE_SCHEDULE = [
  { depth: 0, tier: "PUBLIC",      feeUsd:             0.00 },
  { depth: 1, tier: "LIGHT_PROBE", feeUsd:         1_017.00 },
  { depth: 2, tier: "DER_SCAN",    feeUsd:         5_000.00 },
  { depth: 3, tier: "DEEP_PROBE",  feeUsd: 10_000_000.00 },
] as const;

// DER high-value ASNs (same as middleware.ts DER_ASN_ALIGNMENTS)
const DER_HIGH_VALUE_ASNS = new Set(["36459", "8075"]);

// WAF score threshold that escalates to Forensic Depth 3
const WAF_DEEP_PROBE_THRESHOLD = 80;

// Paths that elevate to a minimum of Forensic Depth 2 (DER scan)
const SENSITIVE_PATHS = ["/hooks/", "/api/v1/vault"];

// ── Depth calculation ─────────────────────────────────────────────────────────

function computeForensicDepth(opts: {
  asn?:         string;
  wafScore?:    number;
  path?:        string;
  threatLevel?: number;
}): number {
  const { asn, wafScore, path, threatLevel } = opts;

  // Explicit threat level override
  if (typeof threatLevel === "number") {
    if (threatLevel >= 10) return 3;
    if (threatLevel >= 8)  return 2;
    if (threatLevel >= 5)  return 1;
    return 0;
  }

  // INGESTION_INTENT algorithm: weighted scoring
  let depth = 0;

  // DER high-value ASN → at least Depth 2
  if (asn && DER_HIGH_VALUE_ASNS.has(asn)) depth = Math.max(depth, 2);

  // Sensitive path probe → at least Depth 2
  if (path && SENSITIVE_PATHS.some(p => path.startsWith(p))) {
    depth = Math.max(depth, 2);
  }

  // WAF high-attack score → escalate to Depth 3
  if (typeof wafScore === "number" && wafScore > WAF_DEEP_PROBE_THRESHOLD) {
    depth = Math.max(depth, 3);
  }

  // DER ASN + WAF > 80 combo → always Depth 3
  if (
    asn && DER_HIGH_VALUE_ASNS.has(asn) &&
    typeof wafScore === "number" && wafScore > WAF_DEEP_PROBE_THRESHOLD
  ) {
    depth = 3;
  }

  return depth;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const asn         = searchParams.get("asn")          ?? undefined;
  const wafScoreRaw = searchParams.get("waf_score");
  const path        = searchParams.get("path")         ?? undefined;
  const tlRaw       = searchParams.get("threat_level");

  const wafScore    = wafScoreRaw  != null ? Number(wafScoreRaw)  : undefined;
  const threatLevel = tlRaw        != null ? Number(tlRaw)        : undefined;

  if (wafScore !== undefined && (isNaN(wafScore) || wafScore < 0 || wafScore > 100)) {
    return Response.json(
      { error: "INVALID_FIELD", detail: "waf_score must be 0–100" },
      { status: 400 },
    );
  }

  const depth   = computeForensicDepth({ asn, wafScore, path, threatLevel });
  const entry   = FEE_SCHEDULE[depth];

  return Response.json({
    fee_usd:        entry.feeUsd,
    forensic_depth: entry.depth,
    tier:           entry.tier,
    kernel_sha:     KERNEL_SHA,
    calculated_at:  formatIso9(),
  });
}
