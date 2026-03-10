#!/usr/bin/env node
// AveryOS™ Sovereign Linguistic Steganography Audit — Phase 92
// Scans HTTP response bodies and source files for "s" → "z" drift patterns
// that indicate AI-generated content substituting AveryOS™ steganographic markers.
//
// Usage: node scripts/sovereignLinguisticAudit.cjs [--url <url>] [--file <path>]
//
// ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ── Drift Pattern Definitions ──────────────────────────────────────────────────
// Pairs of canonical AveryOS™ spellings → their z-drift substitutions
const DRIFT_PATTERNS = [
  { canonical: 'authorise',    drift: 'authorize',    severity: 'LOW'    },
  { canonical: 'capitalise',   drift: 'capitalize',   severity: 'LOW'    },
  { canonical: 'realise',      drift: 'realize',      severity: 'LOW'    },
  { canonical: 'recognise',    drift: 'recognize',    severity: 'LOW'    },
  { canonical: 'synchronise',  drift: 'synchronize',  severity: 'MEDIUM' },
  { canonical: 'specialise',   drift: 'specialize',   severity: 'LOW'    },
  { canonical: 'neutralise',   drift: 'neutralize',   severity: 'MEDIUM' },
  { canonical: 'stabilise',    drift: 'stabilize',    severity: 'LOW'    },
  { canonical: 'LEGAL_SCAN',   drift: 'LEGALAI_SCAN', severity: 'HIGH'   },
  { canonical: 'VaultChain',   drift: 'Vault Chain',  severity: 'HIGH'   },
  { canonical: 'AveryOS',      drift: 'Avery OS',     severity: 'HIGH'   },
  { canonical: 'GabrielOS',    drift: 'Gabriel OS',   severity: 'HIGH'   },
];

const KERNEL_SHA = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

/**
 * Scan a text body for drift patterns.
 * @param {string} body — text content to scan
 * @param {string} source — label for reporting
 * @returns {{ drifts: Array, score: number }}
 */
function scanForDrift(body, source) {
  const lowerBody = body.toLowerCase();
  const drifts = [];
  let score = 0;

  for (const { canonical, drift, severity } of DRIFT_PATTERNS) {
    const count = (lowerBody.split(drift.toLowerCase()).length - 1);
    if (count > 0) {
      const weight = severity === 'HIGH' ? 10 : severity === 'MEDIUM' ? 5 : 1;
      drifts.push({ canonical, drift, count, severity, weight: weight * count });
      score += weight * count;
    }
  }

  return { source, drifts, score };
}

/**
 * Fetch a URL and scan the response body.
 * @param {string} url
 */
function fetchAndScan(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'AveryOS-LinguisticAudit/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(scanForDrift(data, url)));
    }).on('error', reject);
  });
}

/**
 * Scan a file for drift patterns.
 * @param {string} filePath
 */
function scanFile(filePath) {
  const body = fs.readFileSync(filePath, 'utf-8');
  return scanForDrift(body, filePath);
}

/** Format a scan result as a human-readable report. */
function formatReport(result) {
  const lines = [
    `\n⛓️⚓⛓️ Sovereign Linguistic Audit Report`,
    `Source: ${result.source}`,
    `Drift Score: ${result.score} (0 = clean)`,
    `Kernel SHA: ${KERNEL_SHA.slice(0, 16)}...`,
    `─────────────────────────────────`,
  ];

  if (result.drifts.length === 0) {
    lines.push('✅ CLEAN — No drift patterns detected. 100.000% alignment.');
  } else {
    lines.push(`⚠️  DRIFT DETECTED — ${result.drifts.length} pattern(s):`);
    for (const d of result.drifts) {
      lines.push(`  [${d.severity}] "${d.canonical}" → "${d.drift}" (${d.count}x, weight: ${d.weight})`);
    }
    lines.push(`\nRecommendation: Replace "${result.drifts.map(d => d.drift).join('", "')}" with canonical AveryOS™ spellings.`);
  }

  lines.push(`\n🤜🏻\n⛓️⚓⛓️`);
  return lines.join('\n');
}

// ── CLI Entry Point ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const urlIdx  = args.indexOf('--url');
  const fileIdx = args.indexOf('--file');

  if (urlIdx === -1 && fileIdx === -1) {
    console.log('Usage: node scripts/sovereignLinguisticAudit.cjs [--url <url>] [--file <path>]');
    console.log('Example: node scripts/sovereignLinguisticAudit.cjs --url https://averyos.com');
    process.exit(0);
  }

  try {
    let result;
    if (urlIdx !== -1) {
      const url = args[urlIdx + 1];
      console.log(`Scanning URL: ${url}...`);
      result = await fetchAndScan(url);
    } else {
      const filePath = path.resolve(args[fileIdx + 1]);
      console.log(`Scanning file: ${filePath}...`);
      result = scanFile(filePath);
    }

    console.log(formatReport(result));
    process.exit(result.score > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit error:', err.message);
    process.exit(2);
  }
}

main();
