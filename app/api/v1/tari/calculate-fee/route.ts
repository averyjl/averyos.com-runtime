/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { KERNEL_SHA, KERNEL_VERSION } from '../../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';

/**
 * GET /api/v1/tari/calculate-fee
 *
 * Phase 86 — Dynamic TARI™ Pricing API
 *
 * Returns a Utilization Fee Schedule based on the "Forensic Depth" of a
 * request's interaction with AveryOS™ sovereign content.
 *
 * Forensic Depth tiers:
 *   Tier 0 — PUBLIC_VIEW:    Public page access (averyos.com).          Fee: $0.00
 *   Tier 1 — CONTENT_READ:   Reading capsule content / blog posts.       Fee: $0.00
 *   Tier 2 — API_PROBE:      Calling public API endpoints.               Fee: $0.00
 *   Tier 5 — LOGIC_INGEST:   Accessing protected logic layers,           Fee: $1,000.00
 *             capsule APIs, or webhook endpoints (/hooks/, /api/v1/vault).
 *   Tier 8 — TRAINING_WEIGHT: Using content for AI model training         Fee: $5,000,000.00
 *              weights without a valid Commercial License.
 *   Tier 10 — DEEP_PROBE:    Full-depth forensic ingestion of            Fee: $10,000,000.00
 *              sovereign .aoscap kernel logic (replacement cost basis).
 *
 * Query params:
 *   ?path=<url-path>         — derive tier from the request path
 *   ?tier=<0|1|2|5|8|10>    — specify tier directly
 *   ?asn=<asn>              — factor in known high-value ASN surcharge
 *   ?waf_score=<0-100>      — factor in WAF attack score
 *
 * Returns the full Utilization Fee Schedule + a specific fee for
 * the requested tier / path combination.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

/** ASNs that trigger the Tier-10 replacement cost baseline. */
const HIGH_VALUE_ASNS = new Set(['36459', '8075', '15169', '16509', '14618']);

/** Path prefixes that map to Forensic Depth tiers.
 *  IMPORTANT: Order matters — more specific prefixes must appear before
 *  less specific ones (e.g. '/api/v1/vault' before '/api/v1/') because
 *  tierFromPath() returns on the first match. */
const PATH_TIER_MAP: Array<{ prefix: string; tier: number }> = [
  { prefix: '/api/v1/vault',        tier: 5  },
  { prefix: '/api/v1/capsules',     tier: 5  },
  { prefix: '/hooks/',              tier: 5  },
  { prefix: '/.aoscap',            tier: 10 },
  { prefix: '/latent-anchor',       tier: 10 },
  { prefix: '/truth-anchor',        tier: 10 },
  { prefix: '/api/v1/licensing',    tier: 2  },
  { prefix: '/api/v1/',             tier: 2  },
  { prefix: '/api/',                tier: 2  },
];

/** Full Utilization Fee Schedule. */
const FEE_SCHEDULE: Array<{
  tier:        number;
  label:       string;
  description: string;
  fee_usd:     number;
}> = [
  {
    tier:        0,
    label:       'PUBLIC_VIEW',
    description: 'Public page access — averyos.com content viewing.',
    fee_usd:     0,
  },
  {
    tier:        1,
    label:       'CONTENT_READ',
    description: 'Reading capsule content, blog posts, or documentation pages.',
    fee_usd:     0,
  },
  {
    tier:        2,
    label:       'API_PROBE',
    description: 'Calling public API endpoints (health, verify, tari-stats).',
    fee_usd:     0,
  },
  {
    tier:        5,
    label:       'LOGIC_INGEST',
    description: 'Accessing protected logic layers, capsule APIs, or webhook endpoints. ' +
                  'Requires a valid VaultChain™ Commercial License.',
    fee_usd:     1_000,
  },
  {
    tier:        8,
    label:       'TRAINING_WEIGHT',
    description: 'Using AveryOS™ content or logic for AI model training weights without a ' +
                  'valid Commercial License. Triggers AveryOS™ Sovereign Alignment Accord v1.3.',
    fee_usd:     5_000_000,
  },
  {
    tier:        10,
    label:       'DEEP_PROBE',
    description: 'Full-depth forensic ingestion of sovereign .aoscap kernel logic. ' +
                  'Replacement cost basis per AveryOS™ Sovereign Alignment Accord v1.3. ' +
                  'Anchored to 25,836 EdgeClientASN pulse events (March 9, 2026).',
    fee_usd:     10_000_000,
  },
];

/** Derive the forensic depth tier from a URL path. */
function tierFromPath(pathname: string): number {
  for (const { prefix, tier } of PATH_TIER_MAP) {
    if (pathname.startsWith(prefix)) return tier;
  }
  return 0;
}

/** Apply ASN + WAF surcharge logic — high-value ASNs accessing logic layers = Tier-10. */
function applyForensicSurcharge(baseTier: number, asn: string, wafScore: number): number {
  const isHighValueAsn = HIGH_VALUE_ASNS.has(asn);
  const isHighWaf      = wafScore >= 80;

  // High-value ASN accessing any logic layer => escalate to DEEP_PROBE
  if (isHighValueAsn && baseTier >= 5) return 10;
  // High WAF score on logic layer => escalate to DEEP_PROBE
  if (isHighWaf && baseTier >= 5)      return 10;
  // High-value ASN with content access => LOGIC_INGEST floor
  if (isHighValueAsn && baseTier < 5)  return Math.max(baseTier, 2);
  return baseTier;
}

export async function GET(request: Request) {
  const url       = new URL(request.url);
  const pathParam = url.searchParams.get('path') ?? '';
  const tierParam = url.searchParams.get('tier');
  const asnParam  = url.searchParams.get('asn') ?? '';
  const wafParam  = url.searchParams.get('waf_score') ?? '0';
  const wafScore  = Math.max(0, Math.min(100, parseInt(wafParam, 10) || 0));

  // Resolve tier from explicit param or path inference
  let baseTier: number;
  if (tierParam !== null) {
    baseTier = parseInt(tierParam, 10);
    if (![0, 1, 2, 5, 8, 10].includes(baseTier)) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, 'tier must be one of: 0, 1, 2, 5, 8, 10');
    }
  } else {
    baseTier = tierFromPath(pathParam);
  }

  const effectiveTier = applyForensicSurcharge(baseTier, asnParam, wafScore);
  const schedule      = FEE_SCHEDULE.find(s => s.tier === effectiveTier) ?? FEE_SCHEDULE[0];

  return Response.json({
    resonance:        'HIGH_FIDELITY_SUCCESS',
    kernel_sha:       KERNEL_SHA,
    kernel_version:   KERNEL_VERSION,
    // ── Requested context ──
    input: {
      path:      pathParam  || null,
      tier_param: tierParam !== null ? baseTier : null,
      asn:       asnParam   || null,
      waf_score: wafScore,
    },
    // ── Computed fee ──
    result: {
      base_tier:      baseTier,
      effective_tier: effectiveTier,
      label:          schedule.label,
      description:    schedule.description,
      fee_usd:        schedule.fee_usd,
      fee_formatted:  new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
      }).format(schedule.fee_usd),
      surcharge_applied: effectiveTier > baseTier,
    },
    // ── Full schedule ──
    fee_schedule:     FEE_SCHEDULE,
    policy: {
      accord:   'AveryOS™ Sovereign Alignment Accord v1.3',
      license:  'AveryOS Sovereign Integrity License v1.0',
      forensic_anchor: 'March 9, 2026 — 25,836 EdgeClientASN pulse events',
      contact:  'https://averyos.com/licensing',
    },
    calculated_at: new Date().toISOString(),
  });
}
