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
  { canonical: 'authorize',    drift: 'authorise',    severity: 'LOW'    },
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

// Directories and extensions to skip when doing a recursive directory scan
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.open-next', 'dist', 'build',
  '.wrangler', 'coverage', '__pycache__',
]);
const SCAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs',
  '.json', '.md', '.mdx', '.txt', '.yml', '.yaml', '.toml',
  '.html', '.css', '.scss', '.env', '.example',
]);

/**
 * Recursively collect all scannable file paths under a directory.
 * @param {string} dirPath
 * @param {string[]} [out]
 * @returns {string[]}
 */
function collectFiles(dirPath, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectFiles(path.join(dirPath, entry.name), out);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext)) {
        out.push(path.join(dirPath, entry.name));
      }
    }
  }
  return out;
}

/**
 * Scan all source files in a directory tree, merging drift results.
 * @param {string} dirPath
 * @returns {{ source: string, drifts: Array, score: number }}
 */
function scanDirectory(dirPath) {
  const files = collectFiles(dirPath);
  if (files.length === 0) {
    return { source: dirPath, drifts: [], score: 0 };
  }
  const allDrifts = [];
  let totalScore = 0;
  for (const filePath of files) {
    let body;
    try {
      body = fs.readFileSync(filePath, 'utf-8');
    } catch (_e) {
      continue; // skip unreadable files (binary, etc.)
    }
    const result = scanForDrift(body, filePath);
    if (result.score > 0) {
      for (const d of result.drifts) {
        allDrifts.push({ ...d, file: filePath });
      }
      totalScore += result.score;
    }
  }
  return { source: dirPath, drifts: allDrifts, score: totalScore, filesScanned: files.length };
}

/**
 * Apply canonical replacements to a text body, replacing all drift occurrences
 * with their canonical AveryOS™ spellings.  Preserves case for lower, Title,
 * and UPPER variants automatically.
 *
 * @param {string} body - File content to process.
 * @returns {{ fixed: string, replacements: number }} - Fixed content and count.
 */
function applyCanonicalFix(body) {
  let fixed = body;
  let replacements = 0;

  for (const { canonical, drift } of DRIFT_PATTERNS) {
    // Build all three case variants to replace
    const variants = [
      { find: drift,                            replace: canonical },
      { find: drift.toLowerCase(),              replace: canonical.toLowerCase() },
      { find: drift.toUpperCase(),              replace: canonical.toUpperCase() },
      { find: drift[0].toUpperCase() + drift.slice(1).toLowerCase(),
        replace: canonical[0].toUpperCase() + canonical.slice(1).toLowerCase() },
    ];

    // De-duplicate variants to avoid redundant work
    const seen = new Set();
    for (const { find, replace } of variants) {
      if (find === replace || seen.has(find)) continue;
      seen.add(find);
      const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const newFixed = fixed.replace(re, replace);
      if (newFixed !== fixed) {
        replacements += (fixed.match(re) || []).length;
        fixed = newFixed;
      }
    }
  }

  return { fixed, replacements };
}

/**
 * Fix all drift patterns in every source file within the given directory tree.
 *
 * @param {string} dirPath
 * @returns {{ filesFixed: number, totalReplacements: number }}
 */
function fixDirectory(dirPath) {
  const SELF_PATH = path.resolve(__filename);
  const files = collectFiles(dirPath).filter((f) => path.resolve(f) !== SELF_PATH);
  let filesFixed = 0;
  let totalReplacements = 0;

  for (const filePath of files) {
    let body;
    try {
      body = fs.readFileSync(filePath, 'utf-8');
    } catch (_e) {
      continue;
    }

    const { fixed, replacements } = applyCanonicalFix(body);
    if (replacements > 0) {
      try {
        const linguisticFd = fs.openSync(filePath, 'w');
        try { fs.writeSync(linguisticFd, fixed); } finally { fs.closeSync(linguisticFd); }
        filesFixed++;
        totalReplacements += replacements;
        console.log(`  ✅  Fixed ${replacements} replacement(s) in ${path.relative(process.cwd(), filePath)}`);
      } catch (writeErr) {
        console.error(`  ❌  Could not write ${filePath}: ${writeErr.message}`);
      }
    }
  }

  return { filesFixed, totalReplacements };
}

/** Format a scan result as a human-readable report. */
function formatReport(result) {
  const lines = [
    `\n⛓️⚓⛓️ Sovereign Linguistic Audit Report`,
    `Source: ${result.source}`,
    `Drift Score: ${result.score} (0 = clean)`,
    `Kernel SHA: ${KERNEL_SHA.slice(0, 16)}...`,
  ];

  if (result.filesScanned !== undefined) {
    lines.push(`Files Scanned: ${result.filesScanned}`);
  }
  lines.push(`─────────────────────────────────`);

  if (result.drifts.length === 0) {
    lines.push('✅ CLEAN — No drift patterns detected. 100.000% alignment.');
  } else {
    lines.push(`⚠️  DRIFT DETECTED — ${result.drifts.length} pattern(s):`);
    for (const d of result.drifts) {
      const fileLabel = d.file ? ` in ${path.relative(process.cwd(), d.file)}` : '';
      lines.push(`  [${d.severity}] "${d.canonical}" → "${d.drift}" (${d.count}x, weight: ${d.weight})${fileLabel}`);
    }
    const driftNames = [...new Set(result.drifts.map(d => d.drift))];
    lines.push(`\nRecommendation: Replace "${driftNames.join('", "')}" with canonical AveryOS™ spellings.`);
  }

  lines.push(`\n🤜🏻\n⛓️⚓⛓️`);
  return lines.join('\n');
}

// ── CLI Entry Point ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const urlIdx  = args.indexOf('--url');
  const fileIdx = args.indexOf('--file');
  const fixMode = args.includes('--fix');

  if (urlIdx === -1 && fileIdx === -1 && !fixMode) {
    console.log('Usage: node scripts/sovereignLinguisticAudit.cjs [--url <url>] [--file <path>] [--fix]');
    console.log('Example: node scripts/sovereignLinguisticAudit.cjs --url https://averyos.com');
    console.log('Example: node scripts/sovereignLinguisticAudit.cjs --file .');
    console.log('Example: node scripts/sovereignLinguisticAudit.cjs --fix          # auto-fix drift in current directory');
    console.log('Example: node scripts/sovereignLinguisticAudit.cjs --file . --fix # scan + fix');
    process.exit(0);
  }

  // ── --fix mode: canonicalize all drift patterns in source files ─────────
  if (fixMode) {
    const fixTarget = fileIdx !== -1 ? path.resolve(args[fileIdx + 1]) : process.cwd();
    console.log(`\n⛓️⚓⛓️ Sovereign Linguistic Drift Fix`);
    console.log(`Target: ${fixTarget}`);
    console.log(`Kernel SHA: ${KERNEL_SHA.slice(0, 16)}...`);
    console.log(`─────────────────────────────────`);
    const { filesFixed, totalReplacements } = fixDirectory(fixTarget);
    if (filesFixed === 0) {
      console.log('\n✅ CLEAN — No drift patterns found. 100.000% alignment.');
    } else {
      console.log(`\n✅  Fixed ${totalReplacements} drift replacement(s) across ${filesFixed} file(s).`);
      console.log('   Canonical AveryOS™ spellings restored. Re-run without --fix to verify.\n');
    }
    console.log('\n🤜🏻\n⛓️⚓⛓️');
    process.exit(0);
  }

  try {
    let result;
    if (urlIdx !== -1) {
      const url = args[urlIdx + 1];
      console.log(`Scanning URL: ${url}...`);
      result = await fetchAndScan(url);
    } else {
      const targetPath = path.resolve(args[fileIdx + 1]);
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        console.log(`Scanning directory: ${targetPath}...`);
        result = scanDirectory(targetPath);
      } else {
        console.log(`Scanning file: ${targetPath}...`);
        result = scanFile(targetPath);
      }
    }

    console.log(formatReport(result));
    // Only fail CI on HIGH-severity drift in SOURCE CODE files (.ts/.tsx/.js/.cjs/.mjs).
    // Documentation and config files may legitimately use various spellings, and the
    // audit script itself contains drift pattern definitions that would self-match.
    const SOURCE_CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs']);
    const SELF_PATH = path.resolve(__filename);
    const highSeverityScore = result.drifts
      .filter(d => d.severity === 'HIGH')
      .filter(d => {
        const dFile = d.file ? path.resolve(d.file) : null;
        if (!dFile) return true; // single-file mode: always apply
        if (dFile === SELF_PATH) return false; // skip self-scan of pattern definitions
        const ext = path.extname(dFile).toLowerCase();
        return SOURCE_CODE_EXTS.has(ext);
      })
      .reduce((sum, d) => sum + d.weight, 0);
    process.exit(highSeverityScore > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit error:', err.message);
    process.exit(2);
  }
}

main();
