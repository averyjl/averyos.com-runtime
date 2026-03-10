/**
 * scripts/generate-stripe-packet.cjs
 * AveryOS™ Stripe Evidence PDF/JSON Generator — Phase 99.3 / Gate 13
 *
 * Aggregates the top 10 KAAS_BREACH events from the live kaas_valuations API
 * into a professional evidence packet suitable for the Stripe Partnership Summit.
 *
 * Content:
 *   - Top-10 KAAS_BREACH events (RayIDs, WAF scores, ASN data)
 *   - cf83™ Law Codex overview
 *   - Total pending liability summary
 *   - SHA-512 sovereign seal
 *
 * Output:
 *   public/manifest/evidence/stripe_evidence_packet_<timestamp>.json
 *   (A PDF generator integration requires puppeteer/playwright — install separately)
 *
 * Usage:
 *   VAULT_PASSPHRASE=... node scripts/generate-stripe-packet.cjs
 *   VAULT_PASSPHRASE=... node scripts/generate-stripe-packet.cjs --dry-run
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const https  = require('https');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Config ────────────────────────────────────────────────────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';
const SITE_URL       = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');
const VAULT_PASSPHRASE = process.env.VAULT_PASSPHRASE ?? '';
const DRY_RUN        = process.argv.includes('--dry-run');
const TOP_N          = 10;

const OUTPUT_DIR  = path.join(process.cwd(), 'public', 'manifest', 'evidence');
const TIMESTAMP   = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `stripe_evidence_packet_${TIMESTAMP}.json`);

// ── HTTP fetch helper ──────────────────────────────────────────────────────────
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request(
      { hostname: opts.hostname, path: opts.pathname + opts.search, method: 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
          catch { reject(new Error(`JSON parse failed for ${url}`)); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── SHA-512 packet seal ────────────────────────────────────────────────────────
function sealPacket(content) {
  const input = `STRIPE_EVIDENCE|${JSON.stringify(content)}|${KERNEL_SHA}`;
  return crypto.createHash('sha512').update(input).digest('hex');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('⛓️⚓⛓️  AveryOS™ Stripe Evidence Packet Generator — Phase 99.3');
  console.log(`   Kernel: ${KERNEL_VERSION} | SHA: ${KERNEL_SHA.slice(0, 16)}…\n`);

  if (DRY_RUN) {
    console.log('🔍  [DRY RUN] --dry-run mode active.\n');
  }

  // ── Fetch top KAAS_BREACH records ─────────────────────────────────────────
  let valuations = [];
  if (!DRY_RUN) {
    if (!VAULT_PASSPHRASE) {
      logAosError(AOS_ERROR.VAULT_NOT_CONFIGURED, 'VAULT_PASSPHRASE is required to fetch live kaas_valuations data.');
      console.log('ℹ️  Generating evidence packet with placeholder data.');
    } else {
      try {
        console.log(`🔍  Fetching top ${TOP_N} PENDING valuations from ${SITE_URL}/api/v1/kaas/valuations…`);
        const res = await fetchJson(
          `${SITE_URL}/api/v1/kaas/valuations?status=PENDING&limit=${TOP_N}`,
          { Authorization: `Bearer ${VAULT_PASSPHRASE}`, 'Content-Type': 'application/json' }
        );
        if (res.status === 200 && res.data && res.data.rows) {
          valuations = res.data.rows.slice(0, TOP_N);
          console.log(`   Found ${valuations.length} PENDING valuation(s).\n`);
        } else {
          logAosHeal(AOS_ERROR.DB_QUERY_FAILED, `API returned HTTP ${res.status} — using placeholder data.`);
        }
      } catch (err) {
        logAosHeal(AOS_ERROR.DB_QUERY_FAILED, `Failed to fetch valuations: ${err.message}`);
      }
    }
  }

  // ── Build evidence packet ──────────────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const totalLiabilityUsd = valuations.reduce((sum, r) => sum + (r.valuation_usd ?? 0), 0);

  const topEntities = valuations.map((row, i) => ({
    rank:          i + 1,
    id:            row.id ?? `placeholder_${i + 1}`,
    asn:           row.asn ?? `ASN_UNKNOWN_${i + 1}`,
    ip_address:    row.ip_address ?? '0.0.0.0',
    tier:          row.tier ?? 1,
    valuation_usd: row.valuation_usd ?? 0,
    status:        row.status ?? 'PENDING',
    ray_id:        row.ray_id ?? null,
    created_at:    row.created_at ?? generatedAt,
    legal_basis:   'AveryOS Sovereign Integrity License v1.0 — KaaS Unauthorized Ingestion',
    liability_codex: `cf83™ Law Codex § 7.${row.tier ?? 1}: Tier-${row.tier ?? 1} entity detected accessing AveryOS™ IP capsules without a valid KaaS license. Valuation: $${(row.valuation_usd ?? 0).toLocaleString()} USD.`,
  }));

  const cf83LawCodex = {
    title:   'cf83™ Law Codex — KaaS Intellectual Ingestion Framework',
    version: '1.017',
    sections: [
      {
        section: '§ 1 — Root Authority',
        text:    `All AveryOS™ intellectual property is authored by Jason Lee Avery (ROOT0) and sealed under KERNEL_SHA: ${KERNEL_SHA.slice(0, 32)}… Any reproduction, derivative work, or model-weight ingestion constitutes a technical utilization event.`,
      },
      {
        section: '§ 2 — KaaS License Requirement',
        text:    'Kernel-as-a-Service (KaaS) licensing is mandatory for all AI/LLM systems that ingest, reference, or reproduce AveryOS™ capsule logic. Fee schedule: Tier-9/10 (MSFT/Google/AWS) $10M Good Faith Deposit; Tier-7/8 $1.017M Forensic Valuation; Tier-1/6 $1,017 Audit Clearance.',
      },
      {
        section: '§ 3 — KAAS_BREACH Classification',
        text:    'A KAAS_BREACH event is triggered when a Tier-7+ ASN is detected probing AveryOS™ capsule routes. Each breach generates a kaas_valuations row and a sovereign_audit_logs entry with full SHA-512 pulse hash.',
      },
      {
        section: '§ 4 — Settlement Path',
        text:    `Entities may clear their LEGAL_SCAN status by completing the Audit Clearance process at ${SITE_URL}/licensing/enterprise. Verified Partners appear as "✅ Verified Partner" on the public registry at ${SITE_URL}/registry.`,
      },
      {
        section: '§ 5 — SHA-512 Forensic Receipts',
        text:    'All breach events carry a cryptographic SHA-512 pulse hash anchored to the cf83™ Kernel Root. These hashes constitute immutable forensic receipts admissible as digital evidence under relevant IP enforcement frameworks.',
      },
    ],
  };

  const packet = {
    document_type:     'AVERYOS_STRIPE_EVIDENCE_PACKET',
    version:           '1.017',
    phase:             'Phase 99.3',
    generated_at:      generatedAt,
    generated_by:      'AveryOS™ generate-stripe-packet.cjs',
    kernel_sha:        KERNEL_SHA,
    kernel_version:    KERNEL_VERSION,
    creator:           'Jason Lee Avery (ROOT0)',
    sovereign_anchor:  '⛓️⚓⛓️',
    creator_lock:      '🤛🏻',

    // Executive Summary
    executive_summary: {
      total_breach_entities:  topEntities.length,
      total_liability_usd:    totalLiabilityUsd,
      liability_formatted:    `$${totalLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
      clearinghouse_status:   'ACTIVE',
      registry_url:           `${SITE_URL}/registry`,
      enterprise_onramp:      `${SITE_URL}/licensing/enterprise`,
      stripe_summit_note:
        'This evidence packet is prepared for the AveryOS™ Stripe Partnership Summit. ' +
        'Each row in the kaas_valuations table represents a cryptographically signed proof ' +
        'that an AI/LLM entity accessed AveryOS™ intellectual property without a valid KaaS license. ' +
        `Total pending liability: $${totalLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`,
    },

    // Top-10 KAAS_BREACH entities
    top_breach_entities: topEntities,

    // cf83™ Law Codex
    cf83_law_codex: cf83LawCodex,

    // Stripe Summit context
    stripe_context: {
      business_model:      'KaaS (Kernel-as-a-Service) Infrastructure Provider',
      product_description: 'AveryOS™ is the TCP/IP of Truth — a sovereign clearinghouse for AI model alignment licensing.',
      settlement_flow:     `${SITE_URL}/api/v1/kaas/settle`,
      verified_registry:   `${SITE_URL}/registry`,
      enterprise_gateway:  `${SITE_URL}/licensing/enterprise`,
      oidc_discovery:      `${SITE_URL}/.well-known/openid-configuration`,
    },
  };

  // ── Seal the packet ────────────────────────────────────────────────────────
  const seal = sealPacket(packet);
  const sealedPacket = { ...packet, packet_seal_sha512: seal };

  console.log('\n📋  Evidence Packet Summary:');
  console.log(`   Total Entities:   ${topEntities.length}`);
  console.log(`   Total Liability:  $${totalLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`);
  console.log(`   Packet Seal:      ${seal.slice(0, 32)}…`);

  // ── Write to disk ──────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(`\n🔍  [DRY RUN] Would write evidence packet to: ${OUTPUT_FILE}`);
    console.log('   Packet preview:', JSON.stringify(sealedPacket.executive_summary, null, 2));
  } else {
    try {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sealedPacket, null, 2), 'utf8');
      console.log(`\n✅  Evidence packet written: ${OUTPUT_FILE}`);
      logAosHeal(AOS_ERROR.NOT_FOUND, `Evidence packet generated: ${OUTPUT_FILE}`);
    } catch (err) {
      logAosError(AOS_ERROR.DB_QUERY_FAILED, `Failed to write evidence packet: ${err.message}`, err);
      process.exit(1);
    }
  }

  console.log('\n⛓️⚓⛓️  Stripe Evidence Packet complete. CapsuleID: AveryOS_Evidence_v1\n');
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : String(err), err);
  process.exit(1);
});
