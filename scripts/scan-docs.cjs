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
 * scripts/scan-docs.cjs
 *
 * AveryOS™ Docs Secret-Scanner — Phase 110 / GATE 110.2
 *
 * CI gate that fails if any IP address, SHA-512 hash, or secret pattern is
 * found in public-facing documentation files (*.md, *.mdx, *.txt) under
 * the `content/`, `public/`, and root-level doc paths.
 *
 * Intended to be run as part of the CI pipeline BEFORE deploying to Cloudflare
 * so that sovereign IP, kernel anchors, or credentials are never inadvertently
 * exposed in public documentation.
 *
 * Usage:
 *   node scripts/scan-docs.cjs                  # scan default paths
 *   node scripts/scan-docs.cjs --dry-run        # report findings without failing
 *   SCAN_PATHS=content/,public/ node scripts/scan-docs.cjs
 *
 * Exit codes:
 *   0 — No findings; safe to proceed.
 *   1 — One or more findings detected; pipeline should halt.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── CLI flags ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// ── Scan paths ────────────────────────────────────────────────────────────────
const DEFAULT_SCAN_PATHS = ['content', 'public', 'docs'];
const envPaths = process.env.SCAN_PATHS
  ? process.env.SCAN_PATHS.split(',').map(p => p.trim()).filter(Boolean)
  : null;
const SCAN_PATHS = envPaths ?? DEFAULT_SCAN_PATHS;

// ── File extensions to scan ───────────────────────────────────────────────────
const SCAN_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst']);

// ── Allowlisted SHA-512 hashes ─────────────────────────────────────────────────
// These are PUBLICLY DISCLOSED sovereign kernel anchors and evidence fingerprints
// that are intentionally referenced in documentation. They are NOT secrets and
// should not trigger the CI gate.
// Source: lib/sovereignConstants.ts — KERNEL_SHA (cf83...) and Merkle root (88b7...).
const ALLOWED_SHA512 = new Set([
  // Root0 Kernel SHA-512 anchor (publicly disclosed at /witness/disclosure/cf83...)
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
  // VaultBridge Merkle root (publicly disclosed in GoldenLockArtifact.lock.json)
  "88b737926219feb345804a22db4ae3fb2d5b21ca63686075ee04aace4d8ac4fe180289fe821a412944420ec9083b6a6a0e902fc8ac2e0325511cb7ab99ce2abe",
  // Whitepaper evidence fingerprint (public content in content/whitepaper.md)
  "75770aa8a6e63f1c50122cfe28a8a35c5711ed2126ff20a1f704dc54f3bcd17e2f3d69147b41ae21867ac8f32dc2c53e26e72699a007e83dcfc69c95b1718acb",
  // Legal notice capsule SHA-512 (public evidence record in public/license-enforcement/)
  "2152600cfd437d619cb6663e978e9329d8fea2e1c8ac7d8ee67919cc62408e571e6517d7c22b325b366c5ea85f6436e28502e9ea7c2f886a6a125a7170689444",
]);

// ── Secret patterns ───────────────────────────────────────────────────────────
/**
 * Each entry: { name, pattern, description }
 * Patterns are intentionally conservative to avoid false-positives on
 * legitimate documentation examples.
 */
const SECRET_PATTERNS = [
  {
    name:        'IPv4 Address (non-localhost)',
    // Matches valid dotted-quad IPs (each octet 0-255) that are not 127.x.x.x or 0.0.0.0
    pattern:     /\b(?!127\.|0\.0\.0\.0)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    description: 'IP address found in documentation — may expose sovereign node or visitor identity.',
  },
  {
    name:        'SHA-512 Hex String',
    // Full 128-char hex string (SHA-512)
    pattern:     /\b[0-9a-fA-F]{128}\b/g,
    description: 'SHA-512 hash found in documentation — may expose kernel anchor or private capsule fingerprint.',
  },
  {
    name:        'Stripe Secret Key',
    pattern:     /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/g,
    description: 'Stripe secret key found in documentation — CRITICAL: revoke immediately.',
  },
  {
    name:        'Firebase Private Key',
    pattern:     /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
    description: 'PEM private key block found in documentation — may expose Firebase or RSA sovereign key.',
  },
  {
    name:        'Base64 RSA Key (long)',
    // Base64 strings >512 chars are likely encoded key material
    pattern:     /[A-Za-z0-9+/]{512,}={0,2}/g,
    description: 'Long Base64 string found — may be an encoded sovereign RSA key or credential.',
  },
  {
    name:        'GitHub PAT',
    pattern:     /ghp_[0-9a-zA-Z]{36,}/g,
    description: 'GitHub Personal Access Token found in documentation — revoke immediately.',
  },
  {
    name:        'wrangler secret / env var assignment',
    pattern:     /\b(STRIPE_SECRET_KEY|VAULT_PASSPHRASE|FIREBASE_PRIVATE_KEY|AVERYOS_PRIVATE_KEY_B64)\s*=\s*["'][^"']+["']/g,
    description: 'Hardcoded secret assignment found in documentation.',
  },
];

// ── File collector ────────────────────────────────────────────────────────────

/**
 * Recursively collect files with a target extension from a directory.
 * @param {string} dirPath  Absolute path to the directory.
 * @param {string[]} results  Accumulator.
 */
function collectFiles(dirPath, results) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return; // Directory does not exist — skip silently
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next') {
        continue;
      }
      collectFiles(fullPath, results);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
}

// ── Scanner ───────────────────────────────────────────────────────────────────

/**
 * Scan a single file for secret patterns.
 * @param {string} filePath  Absolute path to the file.
 * @returns {{ file: string, name: string, description: string, line: number, match: string }[]}
 */
function scanFile(filePath) {
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    logAosError(AOS_ERROR.NOT_FOUND, `scan-docs: could not read ${filePath}: ${err.message}`);
    return findings;
  }

  const lines = content.split('\n');

  for (const { name, pattern, description } of SECRET_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;

    lines.forEach((line, idx) => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
          // Skip SHA-512 hashes that are publicly-disclosed sovereign anchors
          if (name === 'SHA-512 Hex String' && ALLOWED_SHA512.has(match[0].toLowerCase())) {
            continue;
          }
          findings.push({
          file:        filePath,
          name,
          description,
          line:        idx + 1,
          match:       match[0].slice(0, 80) + (match[0].length > 80 ? '…' : ''),
        });
      }
    });
  }

  return findings;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const repoRoot = path.resolve(process.cwd());
  const allFiles = [];

  for (const scanPath of SCAN_PATHS) {
    const absPath = path.isAbsolute(scanPath) ? scanPath : path.join(repoRoot, scanPath);
    collectFiles(absPath, allFiles);
  }

  if (allFiles.length === 0) {
    console.log('[scan-docs] No documentation files found in scan paths:', SCAN_PATHS.join(', '));
    process.exit(0);
  }

  console.log(`[scan-docs] Scanning ${allFiles.length} documentation file(s) across: ${SCAN_PATHS.join(', ')}`);

  const allFindings = [];
  for (const file of allFiles) {
    const findings = scanFile(file);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log('[scan-docs] ✅ No secret patterns detected. Documentation is clean.');
    logAosHeal(AOS_ERROR.INTERNAL_ERROR, `scan-docs: ${allFiles.length} files scanned — 0 findings.`);
    process.exit(0);
  }

  // ── Report findings ────────────────────────────────────────────────────────
  console.error(`\n[scan-docs] ⚠️  ${allFindings.length} finding(s) detected:\n`);
  for (const f of allFindings) {
    console.error(`  File:  ${path.relative(repoRoot, f.file)}`);
    console.error(`  Rule:  ${f.name}`);
    console.error(`  Line:  ${f.line}`);
    console.error(`  Match: ${f.match}`);
    console.error(`  Note:  ${f.description}`);
    console.error('');
  }

  logAosError(AOS_ERROR.INVALID_FIELD, `scan-docs: ${allFindings.length} finding(s) in documentation.`);

  if (DRY_RUN) {
    console.log('[scan-docs] --dry-run mode: findings reported but exit code is 0.');
    process.exit(0);
  }

  console.error('[scan-docs] ❌ CI gate FAILED. Remove all secrets before deploying.');
  process.exit(1);
}

main();
