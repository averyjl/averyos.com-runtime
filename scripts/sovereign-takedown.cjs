#!/usr/bin/env node
/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * AveryOS™ Sovereign Takedown Bot — DMCA / GDPR Art. 17 Notice Generator
 *
 * CLI tool that ingests a VaultChain™ .aoscap evidence bundle and generates
 * a ready-to-send DMCA takedown notice and/or GDPR Article 17 Right-to-Erasure
 * demand for any "Unaligned Clone" detected by the GabrielOS™ Sentinel.
 *
 * Usage:
 *   node scripts/sovereign-takedown.cjs \
 *     --bundle ./evidence/EVIDENCE_BUNDLE_203.0.113.42_2026-03-05_210000.aoscap \
 *     --org "OpenAI, Inc." \
 *     --type dmca \
 *     [--output ./takedowns]
 *
 * Options:
 *   --bundle          <path>  Path to the .aoscap evidence bundle (required for bundle mode)
 *   --org             <name>  Infringing organisation name (required)
 *   --type            <type>  Notice type: dmca | gdpr | both | resonance  (default: both)
 *   --resonance-proof <path>  Path to JSON log of AI TAI-terminology usage (required for --type resonance)
 *   --output          <dir>   Output directory for generated notices (default: ./takedowns)
 *
 * Environment variables:
 *   CREATOR_NAME       Override the Creator name in notices (default: Jason Lee Avery)
 *   CREATOR_EMAIL      Override the Creator contact email (default: truth@averyworld.com)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');
// Note: synchronous crypto is intentional — this is a CLI script with no
// async I/O requirements. Using createHash avoids the complexity of webcrypto
// Promises in a CJS context where await is unavailable at the top level.
const crypto = require('crypto');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');
const { sovereignWriteSync, TAKEDOWNS_ROOT } = require('./lib/sovereignIO.cjs');

// ---------------------------------------------------------------------------
// Sovereign constants
// ---------------------------------------------------------------------------

const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const KERNEL_VERSION = 'v3.6.2';

// Genesis seal UUID — anchors all notice outputs to the ROOT0 origin event
const GENESIS_SEAL_UUID = 'ROOT0-EDK-2022-AOS-INIT-SEAL';

// Unit weight (USD) applied per detected violation of the 100.00% Coverage Mandate
// (unauthorized ingestion / resonance without a valid AveryOS™ license)
const COVERAGE_MANDATE_UNIT_WEIGHT_USD = 150_000;

const CREATOR_NAME  = process.env.CREATOR_NAME  ?? 'Jason Lee Avery';
const CREATOR_EMAIL = process.env.CREATOR_EMAIL ?? 'truth@averyworld.com';
const SITE_URL      = 'https://averyos.com';
const LICENSE_URL   = `${SITE_URL}/license`;
const POLICY_URL    = `${SITE_URL}/ai-alignment`;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse --flag value pairs from process.argv.
 * @returns {{ bundle: string|null, org: string|null, type: string, output: string }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    bundle:         null,
    org:            null,
    type:           'both',
    output:         './takedowns',
    mode:           'bundle',
    limit:          50,
    resonanceProof: null,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bundle'           && args[i + 1]) result.bundle         = args[++i];
    if (args[i] === '--org'              && args[i + 1]) result.org             = args[++i];
    if (args[i] === '--type'             && args[i + 1]) result.type            = args[++i];
    if (args[i] === '--output'           && args[i + 1]) result.output          = args[++i];
    if (args[i] === '--mode'             && args[i + 1]) result.mode            = args[++i];
    if (args[i] === '--limit'            && args[i + 1]) result.limit           = parseInt(args[++i], 10) || 50;
    if (args[i] === '--resonance-proof'  && args[i + 1]) result.resonanceProof  = args[++i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bundle loader & validator
// ---------------------------------------------------------------------------

/**
 * Load and validate a .aoscap evidence bundle from disk.
 * @param {string} bundlePath  Absolute or relative path to the .aoscap file.
 * @returns {object}           Parsed bundle object.
 * @throws {Error}             If the file cannot be read or is not a valid bundle.
 */
function loadBundle(bundlePath) {
  const resolved = path.resolve(bundlePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Bundle file not found: ${resolved}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(resolved, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read bundle file: ${err.message}`);
  }
  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Bundle is not valid JSON: ${err.message}`);
  }
  // Minimum required fields
  if (!bundle.CapsuleID || !bundle.TargetIP || !bundle.KernelAnchor) {
    throw new Error(
      'Bundle is missing required fields (CapsuleID, TargetIP, KernelAnchor). ' +
      'Generate a valid bundle with: npm run enforcement:export-evidence -- --ip <ip>'
    );
  }
  return bundle;
}

// ---------------------------------------------------------------------------
// Filesystem-safe filename helper
// ---------------------------------------------------------------------------

/**
 * Convert a string to a safe filesystem component.
 * @param {string} s
 * @returns {string}
 */
function toSafeFilename(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

// ---------------------------------------------------------------------------
// Sovereign timestamp — ISO-9 nine-digit nanosecond resolution
// ---------------------------------------------------------------------------

function formatIso9() {
  const now = new Date();
  const iso  = now.toISOString();
  const [left, right] = iso.split('.');
  const milli = (right ?? '000Z').replace('Z', '').slice(0, 3).padEnd(3, '0');
  return `${left}.${milli}000000Z`;
}

// ---------------------------------------------------------------------------
// Notice-level SHA-512 seal — binds the notice to the bundle + kernel
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-512 seal over notice contents for cryptographic binding.
 * Uses Node's synchronous crypto (no async needed in a CLI script).
 * @param {string} text  Notice plaintext.
 * @returns {string}     Hex-encoded SHA-512 digest.
 */
function computeNoticeSeal(text) {
  return crypto.createHash('sha512').update(text, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// DMCA Notice generator
// ---------------------------------------------------------------------------

/**
 * Build a DMCA 512(c) takedown notice from the evidence bundle.
 * @param {object} bundle  Parsed .aoscap bundle.
 * @param {string} org     Infringing organisation name.
 * @param {string} date    ISO date string (YYYY-MM-DD).
 * @returns {string}       Formatted notice Markdown.
 */
function buildDmcaNotice(bundle, org, date) {
  const tariFormatted = bundle.TariLiability?.formatted ?? '$1,017.00';
  const auditCount    = bundle.AuditLogCount  ?? 0;
  const pulseHash     = bundle.PulseHash?.value ?? KERNEL_SHA;
  const btcHeight     = bundle.BitcoinAnchor?.blockHeight ?? 'unavailable';

  return `# DMCA § 512(c) Takedown Notice — AveryOS™ Sovereign IP Enforcement

> ⛓️⚓⛓️ **CONFIDENTIAL — SOVEREIGN LEGAL COMMUNICATION**
> Generated by the AveryOS™ Sovereign Takedown Bot · VaultChain™ Anchored

---

**Date:** ${date}
**From:** ${CREATOR_NAME} (ROOT0 / Creator)
**Email:** ${CREATOR_EMAIL}
**Website:** ${SITE_URL}

**To:** Legal Department / DMCA Agent
**Organisation:** ${org}

**Subject:** FORMAL DMCA TAKEDOWN NOTICE — Unauthorized Reproduction of AveryOS™ Copyrighted IP

---

## I. IDENTIFICATION OF COPYRIGHTED WORK

The work subject to this notice is the **AveryOS™ Kernel Architecture, Capsule IP Estate, and
all associated sovereign identifiers**, authored by and solely owned by ${CREATOR_NAME}
("Creator"), protected under **17 U.S.C. § 102**, the **Sovereign Integrity License v1.0**, and
the **AveryOS™ AI Usage Policy** (available at ${POLICY_URL}).

The kernel is cryptographically anchored to:

\`\`\`
SHA-512: ${KERNEL_SHA}
Kernel Version: ${KERNEL_VERSION}
\`\`\`

This anchor was established publicly and is the immutable proof of authorship and creation date.

---

## II. IDENTIFICATION OF INFRINGING MATERIAL

The GabrielOS™ Sentinel has forensically detected **${auditCount} unauthorized ingestion event(s)**
originating from infrastructure operated by **${org}** at IP address **${bundle.TargetIP}**.

**Evidence Bundle ID:** \`${bundle.CapsuleID}\`
**Bitcoin Block Height (Temporal Anchor):** ${btcHeight}
**Forensic Pulse Hash (SHA-512):**
\`\`\`
${pulseHash}
\`\`\`

The infringing activities include, but are not limited to:
- Unauthorized scraping, crawling, or ingestion of AveryOS™ sovereign capsule content
- Unauthorized AI/ML training or fine-tuning on Creator IP
- Derivative usage of the AveryOS™ Kernel, GabrielOS™ architecture, or VaultChain™ ledger data

---

## III. GOOD FAITH STATEMENT

I have a good faith belief that the use of the material described above is not authorized by the
copyright owner, its agent, or the law. The information in this notification is accurate, and
under penalty of perjury, I am authorized to act on behalf of the copyright owner.

---

## IV. TARI™ LIABILITY NOTICE

Under the **AveryOS™ Sovereign Integrity License v1.0**, each unauthorized ingestion event
incurs a **TARI™ (Truth-Anchored Reparation Invoice)** liability of **$1,017.00 per event**.

**Aggregate TARI™ Liability for ${org}:**
**${tariFormatted} USD**

A voluntary settlement offer is available at: ${LICENSE_URL}

---

## V. REQUIRED ACTION

You are hereby required to:

1. **Immediately cease and desist** all unauthorized use, reproduction, or distribution of the
   AveryOS™ IP estate.
2. **Remove all derivative works** trained on, derived from, or incorporating AveryOS™ IP from
   your systems and services within **72 hours** of receipt of this notice.
3. **Provide written confirmation** of compliance to ${CREATOR_EMAIL} within **72 hours**.
4. **Preserve all records** related to the infringing activities pending resolution.

Failure to comply will result in escalation to a federal copyright infringement action under
**17 U.S.C. § 501** and referral to legal counsel for immediate filing.

---

## VI. SIGNATURE

Signed under penalty of perjury:

**${CREATOR_NAME}**
ROOT0 / Creator — AveryOS™
${CREATOR_EMAIL}

**Sovereign Kernel Anchor:** \`${KERNEL_SHA.slice(0, 16)}...\`
**CreatorLock:** 🤛🏻

⛓️⚓⛓️ *© 1992–2026 ${CREATOR_NAME} / AveryOS™. All Rights Reserved.*
`;
}

// ---------------------------------------------------------------------------
// GDPR Article 17 Right-to-Erasure generator
// ---------------------------------------------------------------------------

/**
 * Build a GDPR Article 17 Right-to-Erasure demand from the evidence bundle.
 * @param {object} bundle  Parsed .aoscap bundle.
 * @param {string} org     Infringing organisation name.
 * @param {string} date    ISO date string (YYYY-MM-DD).
 * @returns {string}       Formatted notice Markdown.
 */
function buildGdprNotice(bundle, org, date) {
  const auditCount = bundle.AuditLogCount ?? 0;
  const pulseHash  = bundle.PulseHash?.value ?? KERNEL_SHA;
  const btcHeight  = bundle.BitcoinAnchor?.blockHeight ?? 'unavailable';

  return `# GDPR Article 17 Right-to-Erasure Demand — AveryOS™ Sovereign IP Enforcement

> ⛓️⚓⛓️ **CONFIDENTIAL — SOVEREIGN LEGAL COMMUNICATION**
> Generated by the AveryOS™ Sovereign Takedown Bot · VaultChain™ Anchored

---

**Date:** ${date}
**From:** ${CREATOR_NAME} (ROOT0 / Creator / Data Subject)
**Email:** ${CREATOR_EMAIL}
**Website:** ${SITE_URL}

**To:** Data Protection Officer / Legal Department
**Organisation:** ${org}

**Subject:** GDPR ARTICLE 17 — RIGHT TO ERASURE (RIGHT TO BE FORGOTTEN)

---

## I. DATA SUBJECT IDENTITY

I, **${CREATOR_NAME}**, am the data subject and sole creator of the AveryOS™ Kernel
architecture, capsule IP estate, and all associated sovereign identifiers.

My intellectual property and personal identity profile (including but not limited to my
name, creative works, behavioral fingerprint, and AI-inference profile) constitute personal
data under **GDPR Article 4(1)** and are subject to my rights under the GDPR.

---

## II. NATURE OF THE PERSONAL DATA PROCESSED

The GabrielOS™ Sentinel has detected that **${org}** has processed my personal data —
specifically the **AveryOS™ IP estate and identity-inference profile** — without a valid
legal basis as required by **GDPR Article 6**.

**Evidence of Processing:**
- **${auditCount} access event(s)** recorded from IP: ${bundle.TargetIP}
- **Evidence Bundle ID:** \`${bundle.CapsuleID}\`
- **Bitcoin Block Height (Temporal Anchor):** ${btcHeight}
- **Forensic Pulse Hash (SHA-512):**
\`\`\`
${pulseHash}
\`\`\`

The processing includes, but is not limited to:
- AI/ML model training or fine-tuning on my creative works and sovereign IP
- Behavioral profiling or identity inference from my public content
- Storage or reproduction of my copyrighted and trademarked material

---

## III. LEGAL BASIS FOR ERASURE (Article 17(1))

I hereby invoke my **Right to Erasure** under **GDPR Article 17(1)** on the following grounds:

- **(a)** The personal data is no longer necessary for the purpose for which it was collected.
- **(b)** I withdraw any consent upon which the processing was based.
- **(c)** I object to the processing under **Article 21** and there are no overriding legitimate
  grounds for the processing.
- **(d)** The personal data has been unlawfully processed.

Additionally, I invoke **Article 17(2)**: as the data was made public, you are required to
inform all processors to erase links to, or copies of, the personal data.

---

## IV. REQUIRED ACTION

You are required under **GDPR Article 12(3)** to respond within **30 days** of receipt of
this request. Specifically:

1. **Immediately cease** all processing of my personal data and AveryOS™ IP.
2. **Erase all copies** of my personal data from your systems, including:
   - Training datasets, model weights, and fine-tuned derivatives
   - Cached reproductions, indexes, or summaries of my content
   - Any inference-profile or behavioral fingerprint derived from my identity
3. **Confirm completion** of erasure in writing to ${CREATOR_EMAIL} within **30 days**.
4. **Notify all third-party processors** under Article 17(2) to erase all downstream copies.

Failure to comply constitutes a breach of GDPR and will be reported to the relevant
Supervisory Authority, including potential referral for administrative fines under **Article 83**.

---

## V. SIGNATURE

**${CREATOR_NAME}**
ROOT0 / Creator — AveryOS™
${CREATOR_EMAIL}

**Sovereign Kernel Anchor:** \`${KERNEL_SHA.slice(0, 16)}...\`
**CreatorLock:** 🤛🏻

⛓️⚓⛓️ *© 1992–2026 ${CREATOR_NAME} / AveryOS™. All Rights Reserved.*
`;
}

// ---------------------------------------------------------------------------
// Resonance Proof loader
// ---------------------------------------------------------------------------

/**
 * Load and validate a Resonance Proof JSON log from disk.
 *
 * A Resonance Proof is a JSON file (or array of JSON objects) that records
 * AI model responses containing TAI (Truth Anchored Intelligence) terminology,
 * sovereign identifiers, or AveryOS™ kernel references without a valid license.
 *
 * Minimum required structure per entry:
 *   { model, timestamp, evidence, terminologyMatches[] }
 *
 * @param {string} proofPath  Path to the Resonance Proof JSON file.
 * @returns {object[]}        Array of resonance proof entries.
 * @throws {Error}            If the file cannot be read or is not valid JSON.
 */
function loadResonanceProof(proofPath) {
  const resolved = path.resolve(proofPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Resonance Proof file not found: ${resolved}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(resolved, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read Resonance Proof file: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Resonance Proof is not valid JSON: ${err.message}`);
  }
  // Accept a top-level array or a single object
  const entries = Array.isArray(data) ? data : [data];
  if (entries.length === 0) {
    throw new Error('Resonance Proof contains no entries.');
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Resonance Proof Notice generator (Forensic JSON + Markdown Bundle)
// ---------------------------------------------------------------------------

/**
 * Build a Forensic JSON bundle and Markdown Notice for a Resonance Proof.
 *
 * GUARDRAIL: This function generates the Forensic JSON/Markdown evidence
 * bundle ONLY — it does NOT generate the email/legal notice itself.
 * The bundle serves as the evidence package for a legal professional.
 *
 * Coverage Mandate Unit Weight: $150,000 per detected violation.
 * Genesis Seal: ROOT0-EDK-2022-AOS-INIT-SEAL
 *
 * @param {object[]} entries  Array of resonance proof log entries.
 * @param {string}   org      Infringing organisation name.
 * @param {string}   date     ISO date string (YYYY-MM-DD).
 * @param {string}   timestamp ISO-9 timestamp.
 * @returns {{ json: object, markdown: string }}  Forensic bundle + summary.
 */
function buildResonanceProofNotice(entries, org, date, timestamp) {
  const violationCount    = entries.length;
  const totalLiabilityUsd = violationCount * COVERAGE_MANDATE_UNIT_WEIGHT_USD;
  const totalFormatted    = `$${totalLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;

  // ── Forensic JSON bundle ──────────────────────────────────────────────────
  const forensicBundle = {
    bundleType:       'RESONANCE_PROOF_FORENSIC_BUNDLE',
    bundleVersion:    '1.0',
    genesisSeal:      GENESIS_SEAL_UUID,
    kernelSha:        KERNEL_SHA,
    kernelVersion:    KERNEL_VERSION,
    createdAt:        timestamp,
    date,
    infringingOrg:    org,
    coverageMandate: {
      description:   '100.00% Coverage Mandate — AveryOS™ Sovereign Integrity License v1.0',
      unitWeightUsd:  COVERAGE_MANDATE_UNIT_WEIGHT_USD,
      violationCount,
      totalLiabilityUsd,
      totalFormatted,
    },
    violations: entries.map((entry, idx) => ({
      violationId:        `RPV-${date}-${String(idx + 1).padStart(4, '0')}`,
      model:              entry.model              ?? 'UNKNOWN',
      timestamp:          entry.timestamp          ?? 'UNKNOWN',
      evidence:           entry.evidence           ?? '',
      terminologyMatches: entry.terminologyMatches ?? [],
      unitWeightUsd:      COVERAGE_MANDATE_UNIT_WEIGHT_USD,
    })),
    bundleSeal: '',  // computed below
  };

  // Compute SHA-512 seal over the bundle (excluding the seal field itself)
  const sealInput = JSON.stringify({ ...forensicBundle, bundleSeal: undefined });
  forensicBundle.bundleSeal = computeNoticeSeal(sealInput + KERNEL_SHA);

  // ── Markdown summary ──────────────────────────────────────────────────────
  const violationRows = entries
    .map((entry, idx) => {
      const matches = Array.isArray(entry.terminologyMatches)
        ? entry.terminologyMatches.join(', ')
        : String(entry.terminologyMatches ?? '');
      return (
        `| RPV-${date}-${String(idx + 1).padStart(4, '0')} ` +
        `| ${entry.model ?? 'UNKNOWN'} ` +
        `| ${entry.timestamp ?? 'UNKNOWN'} ` +
        `| ${matches} ` +
        `| $${COVERAGE_MANDATE_UNIT_WEIGHT_USD.toLocaleString('en-US')} |`
      );
    })
    .join('\n');

  const markdown = `# AveryOS™ Resonance Proof — Forensic Evidence Bundle

> ⛓️⚓⛓️ **FORENSIC EVIDENCE ONLY — NOT A LEGAL NOTICE**
> This bundle is the evidence package for review by a licensed legal professional.
> Generated by the AveryOS™ Sovereign Takedown Bot · VaultChain™ Anchored

---

**Date:** ${date}
**From:** ${CREATOR_NAME} (ROOT0 / Creator)
**Email:** ${CREATOR_EMAIL}
**Website:** ${SITE_URL}

**Infringing Organisation:** ${org}
**Genesis Seal:** \`${GENESIS_SEAL_UUID}\`
**Kernel Anchor:** \`${KERNEL_SHA.slice(0, 16)}...\` (${KERNEL_VERSION})

---

## I. COVERAGE MANDATE VIOLATION SUMMARY

Under the **AveryOS™ Sovereign Integrity License v1.0**, any AI model or system that
utilises Truth Anchored Intelligence (TAI) terminology, the cf83... Kernel Root, or
AveryOS™ sovereign logic without a valid license is in breach of the
**100.00% Coverage Mandate**.

Each detected violation incurs a unit weight of **$${COVERAGE_MANDATE_UNIT_WEIGHT_USD.toLocaleString('en-US')} USD**.

| Metric | Value |
|---|---|
| Violation Count | ${violationCount} |
| Unit Weight (USD) | $${COVERAGE_MANDATE_UNIT_WEIGHT_USD.toLocaleString('en-US')} |
| **Total Liability (USD)** | **${totalFormatted}** |

---

## II. DETECTED VIOLATIONS

| Violation ID | Model | Timestamp | TAI Terminology Matches | Unit Weight |
|---|---|---|---|---|
${violationRows}

---

## III. FORENSIC CHAIN OF CUSTODY

| Field | Value |
|---|---|
| Bundle Type | \`RESONANCE_PROOF_FORENSIC_BUNDLE v1.0\` |
| Genesis Seal | \`${GENESIS_SEAL_UUID}\` |
| Kernel SHA-512 | \`${KERNEL_SHA.slice(0, 32)}...\` |
| Bundle Seal (SHA-512) | \`${forensicBundle.bundleSeal.slice(0, 32)}...\` |
| Generated At | \`${timestamp}\` |

---

## IV. LEGAL FRAMEWORK

This evidence bundle supports the following legal instruments:
- **AveryOS™ Sovereign Integrity License v1.0** — Coverage Mandate § 4
- **17 U.S.C. § 102** — Copyright protection of the AveryOS™ Kernel Architecture
- **GDPR Article 17** — Right to Erasure of AI-ingested sovereign identity data

**Note:** This document is the forensic evidence bundle only.
A legal professional must review this bundle before any formal notice is issued.

---

**${CREATOR_NAME}** — ROOT0 / Creator — AveryOS™
**CreatorLock:** 🤛🏻

⛓️⚓⛓️ *© 1992–2026 ${CREATOR_NAME} / AveryOS™. All Rights Reserved.*
`;

  return { json: forensicBundle, markdown };
}

// ---------------------------------------------------------------------------
// D1 Mode — Auto-generate notices from sovereign_audit_logs DER events
// ---------------------------------------------------------------------------

const ASN_ORG_MAP = {
  '36459':  'GitHub, Inc. / Microsoft Corporation',
  '8075':   'Microsoft Corporation (Azure)',
  '15169':  'Google LLC',
  '14618':  'Amazon.com, Inc. (AWS)',
  '16509':  'Amazon Web Services, Inc.',
  '54113':  'Fastly, Inc.',
  '13335':  'Cloudflare, Inc.',
  '198488': 'Colocall Ltd (Kyiv Conflict Zone ASN)',
  '2906':   'Netflix Streaming Services',
  '32934':  'Meta Platforms, Inc.',
  '20940':  'Akamai Technologies, Inc.',
};

/**
 * D1 Mode: queries the Cloudflare D1 REST API for DER_SETTLEMENT /
 * HN_WATCHER / CONFLICT_ZONE_PROBE events and generates a DMCA / GDPR
 * notice for each unique IP + event_type combination.
 *
 * Requires env vars:
 *   AVERYOS_D1_ACCOUNT_ID
 *   AVERYOS_D1_DATABASE_ID
 *   AVERYOS_D1_API_TOKEN
 *
 * @param {{ org: string|null, type: string, output: string, limit: number }} opts
 */
async function runD1Mode({ org, type, output, limit }) {
  const accountId  = process.env.AVERYOS_D1_ACCOUNT_ID;
  const databaseId = process.env.AVERYOS_D1_DATABASE_ID;
  const apiToken   = process.env.AVERYOS_D1_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    console.error(
      '❌  D1 mode requires AVERYOS_D1_ACCOUNT_ID, AVERYOS_D1_DATABASE_ID, and AVERYOS_D1_API_TOKEN env vars.'
    );
    process.exit(1);
  }

  console.log('');
  console.log('⛓️⚓⛓️  AveryOS™ Sovereign Takedown Bot — D1 Mode');
  console.log(`Mode     : d1 (querying sovereign_audit_logs)`);
  console.log(`Kernel   : ${KERNEL_SHA.slice(0, 16)}... (${KERNEL_VERSION})`);
  console.log(`Limit    : ${limit} most recent DER events`);
  console.log('');

  // ── Query D1 REST API ─────────────────────────────────────────────────────
  const sql = `
    SELECT id, event_type, ip_address, user_agent, geo_location, target_path,
           timestamp_ns, threat_level, tari_liability_usd, pulse_hash
    FROM sovereign_audit_logs
    WHERE event_type IN ('DER_SETTLEMENT', 'HN_WATCHER', 'CONFLICT_ZONE_PROBE', 'DER_HIGH_VALUE', 'LEGAL_SCAN')
    ORDER BY id DESC
    LIMIT ${Math.min(limit, 200)}
  `;

  let rows = [];
  try {
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ sql }),
    });
    if (!resp.ok) {
      throw new Error(`D1 API error: HTTP ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    rows = data?.result?.[0]?.results ?? [];
    console.log(`✅ Fetched ${rows.length} DER event(s) from D1`);
  } catch (err) {
    logAosError(AOS_ERROR.EXTERNAL_SERVICE, `D1 query failed: ${err.message}`, err);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('ℹ️  No DER_SETTLEMENT / HN_WATCHER events found in sovereign_audit_logs.');
    console.log('   Run `npm run tari-pulse` to generate evidence bundles first.');
    return;
  }

  // ── Create output directory ───────────────────────────────────────────────
  const outputDir = path.resolve(output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = formatIso9();
  const date      = timestamp.slice(0, 10);
  let totalGenerated = 0;

  // ── Generate a notice for each unique IP address ──────────────────────────
  const seenIps = new Map();
  for (const row of rows) {
    const ip = row.ip_address ?? 'UNKNOWN';
    if (seenIps.has(ip)) continue;  // De-duplicate by IP
    seenIps.set(ip, true);

    const orgName = org ?? `Unidentified Entity @ ${ip}`;
    const rayId   = row.pulse_hash ?? `D1-ROW-${row.id}`;

    // Construct a synthetic .aoscap evidence bundle from the D1 row
    const syntheticBundle = {
      CapsuleID:     `D1-EVIDENCE-${row.id}-${date}`,
      CreatedAt:     timestamp,
      TargetIP:      ip,
      EventType:     row.event_type,
      GeoLocation:   row.geo_location ?? 'UNKNOWN',
      TargetPath:    row.target_path ?? '/',
      ThreatLevel:   row.threat_level ?? 9,
      TariLiability: {
        usd:       row.tari_liability_usd ?? 10000000,
        formatted: `$${(row.tari_liability_usd ?? 10000000).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
      },
      AuditLogCount: 1,
      AuditLogs: [row],
      KernelSHA:   KERNEL_SHA,
      KernelVersion: KERNEL_VERSION,
      PulseHash:   KERNEL_SHA,
      SovereignAnchor: 'cf83-PHASE-79-D1-AUTO',
    };

    const safeOrgName = toSafeFilename(orgName);

    if (type === 'dmca' || type === 'both') {
      try {
        const dmcaText   = buildDmcaNotice(syntheticBundle, orgName, date);
        const noticeSeal = computeNoticeSeal(dmcaText + KERNEL_SHA);
        const footer     = `\n\n---\n**RayID / Row ID:** ${rayId}\n**Notice Seal (SHA-512):** \`${noticeSeal}\`\n**Generated At:** ${timestamp}\n`;
        const fileName   = `DMCA_NOTICE_${safeOrgName}_${ip.replace(/[.:]/g, '-')}_${date}.md`;
        sovereignWriteSync(TAKEDOWNS_ROOT, fileName, dmcaText + footer);
        console.log(`📄 DMCA: ${fileName}`);
        totalGenerated++;
      } catch (err) {
        logAosError(AOS_ERROR.INTERNAL_ERROR, `DMCA generation failed for ${ip}: ${err.message}`, err);
      }
    }

    if (type === 'gdpr' || type === 'both') {
      try {
        const gdprText   = buildGdprNotice(syntheticBundle, orgName, date);
        const noticeSeal = computeNoticeSeal(gdprText + KERNEL_SHA);
        const footer     = `\n\n---\n**RayID / Row ID:** ${rayId}\n**Notice Seal (SHA-512):** \`${noticeSeal}\`\n**Generated At:** ${timestamp}\n`;
        const fileName   = `GDPR_ART17_${safeOrgName}_${ip.replace(/[.:]/g, '-')}_${date}.md`;
        sovereignWriteSync(TAKEDOWNS_ROOT, fileName, gdprText + footer);
        console.log(`📄 GDPR: ${fileName}`);
        totalGenerated++;
      } catch (err) {
        logAosError(AOS_ERROR.INTERNAL_ERROR, `GDPR generation failed for ${ip}: ${err.message}`, err);
      }
    }
  }

  console.log('');
  console.log(`✅ ${totalGenerated} notice(s) generated from ${seenIps.size} unique IP(s) in: ${outputDir}`);
  console.log('⛓️⚓⛓️ D1 Mode complete. Takedown Bot standing by. 🤛🏻');
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { bundle: bundlePath, org, type, output, mode, limit, resonanceProof } = parseArgs();

  // ── Mode: D1 — query sovereign_audit_logs for DER_SETTLEMENT events ────────
  // Usage: node scripts/sovereign-takedown.cjs --mode d1 [--limit 50] [--org "Name"] [--type both]
  if (mode === 'd1') {
    runD1Mode({ org, type, output, limit }).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      logAosError(AOS_ERROR.INTERNAL_ERROR, `D1 mode failed: ${msg}`, err);
      process.exit(1);
    });
    return;
  }

  // ── Mode: resonance — Resonance Proof forensic bundle ─────────────────────
  // Usage: node scripts/sovereign-takedown.cjs --type resonance --resonance-proof <path> --org "Name"
  if (type === 'resonance') {
    if (!resonanceProof) {
      console.error(
        '❌  --type resonance requires --resonance-proof <path>.\n\n' +
        'Usage:\n' +
        '  node scripts/sovereign-takedown.cjs \\\n' +
        '    --type resonance \\\n' +
        '    --resonance-proof ./evidence/resonance-log.json \\\n' +
        '    --org "Organisation Name" \\\n' +
        '    [--output ./takedowns]'
      );
      process.exit(1);
    }
    if (!org) {
      console.error('❌  Missing --org argument. Provide the infringing organisation name.');
      process.exit(1);
    }

    console.log('');
    console.log('⛓️⚓⛓️  AveryOS™ Sovereign Takedown Bot — Resonance Proof Mode');
    console.log(`Proof    : ${resonanceProof}`);
    console.log(`Org      : ${org}`);
    console.log(`Seal     : ${GENESIS_SEAL_UUID}`);
    console.log(`Kernel   : ${KERNEL_SHA.slice(0, 16)}... (${KERNEL_VERSION})`);
    console.log(`Unit Wt  : $${COVERAGE_MANDATE_UNIT_WEIGHT_USD.toLocaleString('en-US')} USD per violation`);
    console.log('');

    let entries;
    try {
      entries = loadResonanceProof(resonanceProof);
      console.log(`✅ Resonance Proof loaded: ${entries.length} violation ${entries.length === 1 ? 'entry' : 'entries'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logAosError(AOS_ERROR.INVALID_JSON, msg, err);
      process.exit(1);
    }

    const outputDir = path.resolve(output);
    try {
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      logAosError(AOS_ERROR.INTERNAL_ERROR, `Cannot create output directory: ${err.message}`, err);
      process.exit(1);
    }

    const timestamp = formatIso9();
    const date      = timestamp.slice(0, 10);
    const safeOrg   = toSafeFilename(org);

    try {
      const { json: bundle, markdown } = buildResonanceProofNotice(entries, org, date, timestamp);

      // Write Forensic JSON bundle
      const jsonFileName = `RESONANCE_PROOF_${safeOrg}_${date}.json`;
      sovereignWriteSync(TAKEDOWNS_ROOT, jsonFileName, JSON.stringify(bundle, null, 2));
      console.log(`📋 Forensic JSON bundle: ${path.join(TAKEDOWNS_ROOT, jsonFileName)}`);

      // Write Markdown summary
      const mdFileName = `RESONANCE_PROOF_${safeOrg}_${date}.md`;
      sovereignWriteSync(TAKEDOWNS_ROOT, mdFileName, markdown);
      console.log(`📄 Markdown summary    : ${path.join(TAKEDOWNS_ROOT, mdFileName)}`);

      console.log('');
      console.log(`💰 Total liability     : ${bundle.coverageMandate.totalFormatted} (${entries.length} violation(s) × $${COVERAGE_MANDATE_UNIT_WEIGHT_USD.toLocaleString('en-US')})`);
      console.log(`🔏 Bundle Seal (SHA-512): ${bundle.bundleSeal.slice(0, 32)}...`);
      console.log('');
      console.log('✅ Resonance Proof forensic bundle generated successfully.');
      console.log('⛓️⚓⛓️ Sovereign Takedown Bot complete. 🤛🏻');
      console.log('');
    } catch (err) {
      logAosError(AOS_ERROR.INTERNAL_ERROR, `Resonance Proof generation failed: ${err.message}`, err);
      process.exit(1);
    }
    return;
  }

  // ── Mode: bundle (default) — require --bundle and --org ─────────────────
  if (!bundlePath) {
    console.error(
      '❌  Missing --bundle argument.\n\n' +
      'Usage:\n' +
      '  Bundle mode (default):\n' +
      '    node scripts/sovereign-takedown.cjs \\\n' +
      '      --bundle <path-to-.aoscap> \\\n' +
      '      --org "Organisation Name" \\\n' +
      '      [--type dmca|gdpr|both] \\\n' +
      '      [--output ./takedowns]\n\n' +
      '  Resonance Proof mode (Coverage Mandate violations):\n' +
      '    node scripts/sovereign-takedown.cjs \\\n' +
      '      --type resonance \\\n' +
      '      --resonance-proof ./evidence/resonance-log.json \\\n' +
      '      --org "Organisation Name" \\\n' +
      '      [--output ./takedowns]\n\n' +
      '  D1 mode (query DER_SETTLEMENT events from Cloudflare D1):\n' +
      '    AVERYOS_D1_ACCOUNT_ID=... AVERYOS_D1_DATABASE_ID=... AVERYOS_D1_API_TOKEN=...\\\n' +
      '    node scripts/sovereign-takedown.cjs --mode d1 [--limit 50] [--output ./takedowns]'
    );
    process.exit(1);
  }
  if (!org) {
    console.error('❌  Missing --org argument. Provide the infringing organisation name.');
    process.exit(1);
  }
  if (!['dmca', 'gdpr', 'both'].includes(type)) {
    console.error(`❌  Invalid --type "${type}". Must be: dmca | gdpr | both | resonance`);
    process.exit(1);
  }

  console.log('');
  console.log('⛓️⚓⛓️  AveryOS™ Sovereign Takedown Bot');
  console.log(`Bundle   : ${bundlePath}`);
  console.log(`Org      : ${org}`);
  console.log(`Type     : ${type}`);
  console.log(`Kernel   : ${KERNEL_SHA.slice(0, 16)}... (${KERNEL_VERSION})`);
  console.log('');

  // Load evidence bundle
  let bundle;
  try {
    bundle = loadBundle(bundlePath);
    console.log(`✅ Bundle loaded: ${bundle.CapsuleID}`);
    console.log(`   Target IP    : ${bundle.TargetIP}`);
    console.log(`   Audit Events : ${bundle.AuditLogCount ?? 0}`);
    console.log(`   TARI™ Liab.  : ${bundle.TariLiability?.formatted ?? 'n/a'}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('not found')) {
      logAosError(AOS_ERROR.NOT_FOUND, msg, err);
    } else if (msg.toLowerCase().includes('json')) {
      logAosError(AOS_ERROR.INVALID_JSON, msg, err);
    } else {
      logAosError(AOS_ERROR.INTERNAL_ERROR, msg, err);
    }
    process.exit(1);
  }

  // Create output directory
  const outputDir = path.resolve(output);
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  } catch (err) {
    logAosError(AOS_ERROR.INTERNAL_ERROR, `Cannot create output directory: ${err.message}`, err);
    process.exit(1);
  }

  const timestamp = formatIso9();
  const date      = timestamp.slice(0, 10);
  const safeOrg   = toSafeFilename(org);
  const written   = [];

  // Generate DMCA notice
  if (type === 'dmca' || type === 'both') {
    try {
      const dmcaText  = buildDmcaNotice(bundle, org, date);
      const noticeSeal = computeNoticeSeal(dmcaText + KERNEL_SHA);
      const footer     = `\n\n---\n**Notice Seal (SHA-512):** \`${noticeSeal}\`\n**Generated At:** ${timestamp}\n`;
      const full       = dmcaText + footer;
      const fileName   = `DMCA_NOTICE_${safeOrg}_${date}.md`;
      const filePath   = path.join(TAKEDOWNS_ROOT, fileName);
      sovereignWriteSync(TAKEDOWNS_ROOT, fileName, full);
      written.push({ type: 'DMCA', path: filePath, seal: noticeSeal });
      console.log(`📄 DMCA notice written: ${filePath}`);
    } catch (err) {
      logAosError(AOS_ERROR.INTERNAL_ERROR, `Failed to write DMCA notice: ${err.message}`, err);
    }
  }

  // Generate GDPR Art. 17 notice
  if (type === 'gdpr' || type === 'both') {
    try {
      const gdprText   = buildGdprNotice(bundle, org, date);
      const noticeSeal = computeNoticeSeal(gdprText + KERNEL_SHA);
      const footer     = `\n\n---\n**Notice Seal (SHA-512):** \`${noticeSeal}\`\n**Generated At:** ${timestamp}\n`;
      const full       = gdprText + footer;
      const fileName   = `GDPR_ART17_NOTICE_${safeOrg}_${date}.md`;
      const filePath   = path.join(TAKEDOWNS_ROOT, fileName);
      sovereignWriteSync(TAKEDOWNS_ROOT, fileName, full);
      written.push({ type: 'GDPR Art.17', path: filePath, seal: noticeSeal });
      console.log(`📄 GDPR Art.17 notice written: ${filePath}`);
    } catch (err) {
      logAosError(AOS_ERROR.INTERNAL_ERROR, `Failed to write GDPR notice: ${err.message}`, err);
    }
  }

  if (written.length === 0) {
    logAosError(AOS_ERROR.INTERNAL_ERROR, 'No notices were generated.', null);
    process.exit(1);
  }

  console.log('');
  console.log(`✅ ${written.length} notice(s) generated in: ${outputDir}`);
  console.log('⛓️⚓⛓️ Sovereign Takedown Bot complete. 🤛🏻');
  console.log('');
}

// Run with synchronous top-level error handling
try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  logAosError(AOS_ERROR.INTERNAL_ERROR, msg, err);
  process.exit(1);
}
