/**
 * scripts/sovereign-leak-guard.cjs
 *
 * AveryOS™ Sovereign Leak Guard — Dynamic Git-Tree Protection
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 *
 * PURPOSE
 * -------
 * A server-side CI gate that provides FOUR layers of protection beyond .gitignore:
 *
 *   Layer 1 — Git-Tree Pattern Guard:
 *     Reads ALL patterns from .gitignore at runtime (dynamic — stays current as
 *     .gitignore grows) and checks `git ls-files` output against every pattern.
 *     Catches files that were force-added (`git add -f`) or committed with
 *     `--no-verify` to bypass the local .gitignore. Covers ALL categories:
 *     key files, docs, tests, test suites, logs, configs, env files, backups, etc.
 *     Correctly applies gitignore negation rules (! re-allow lines) so that
 *     intentionally-tracked exceptions (e.g., .gitkeep, source capsule files)
 *     do not produce false positives.
 *
 *   Layer 2 — Content Pattern Guard:
 *     Scans ALL tracked files for embedded private key material:
 *     PEM blocks with actual key content, Stripe live keys, GitHub PATs.
 *     Catches secrets that sneak into tracked source/test/doc files.
 *
 *   Layer 3 — Key/Token Filename Auto-Guard (Gate 111.5.3):
 *     Scans ALL files (tracked + untracked) for filenames containing "key" or
 *     "token". Checks content for actual key material and auto-adds to .gitignore.
 *
 *   Layer 4 — HAR File Key-Pattern Auto-Detection (Gate 113.5):
 *     Scans ALL tracked .har files for Authorization headers, Bearer tokens,
 *     API keys, and private key material embedded in request/response entries.
 *     HAR files capture full HTTP traffic and commonly expose credentials.
 *
 * RULE: Do NOT remove, weaken, or bypass this gate.
 *       Added by Jason Lee Avery (ROOT0). Requires ROOT0 consent to modify.
 *
 * Usage:
 *   node scripts/sovereign-leak-guard.cjs            # CI mode: exit 1 on finding
 *   node scripts/sovereign-leak-guard.cjs --dry-run  # report only, exit 0
 *
 * Exit codes:
 *   0 — Clean. No violations found.
 *   1 — Violations found (or .gitignore unreadable). Pipeline must halt.
 *
 * ⛓️⚓⛓️
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');
const { CODE_EXTENSIONS, PROTECTED_DIRS, KEY_CONTENT_PATTERNS } = require('./sovereignGuardConfig.cjs');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// ── Repo root ─────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(process.cwd());

// ── Layer 2: Content patterns — secrets that must never appear in ANY tracked file
//
// Pattern design principles to minimise false positives:
//   • PEM detection requires actual base64 key material on the next line
//     (not just the header text appearing in a comment or code string literal).
//   • Only Stripe LIVE keys are flagged (sk_live_...) — test keys are acceptable
//     in test fixtures.
//   • Long base64 strings are only flagged when ≥ 512 chars (≈ 3072-bit minimum),
//     reducing false positives from short data URIs or hashes.
const CONTENT_SECRET_PATTERNS = [
  {
    name:        'PEM Private Key Block (with key material)',
    // Require the header to be followed by an actual base64-encoded key body —
    // this prevents false positives when the header text appears in code comments,
    // regex literals, or string replacement helpers (e.g., lib/firebaseClient.ts).
    regex:       /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/]{10}/,
    description: 'RSA/EC/OPENSSH private key PEM block with key material — rotate immediately.',
  },
  {
    name:        'Stripe Live Secret Key',
    // Only flag LIVE keys (sk_live_...) — test keys are acceptable in test fixtures.
    regex:       /\bsk_live_[0-9a-zA-Z]{24,}\b/,
    description: 'Stripe LIVE secret key — revoke and rotate at https://dashboard.stripe.com/apikeys',
  },
  {
    name:        'GitHub Personal Access Token',
    regex:       /\bghp_[0-9a-zA-Z]{36,}\b/,
    description: 'GitHub PAT — revoke at https://github.com/settings/tokens',
  },
  {
    name:        'Firebase Service-Account Private Key',
    // Firebase service account JSON contains: "private_key": "-----BEGIN ...
    // followed by base64 key material. Require key material to avoid false positives
    // on comments that reference the format.
    regex:       /"private_key"\s*:\s*"-----BEGIN[^"]{50,}/,
    description: 'Firebase service-account private key in tracked file — never commit service-account JSON.',
  },
  {
    name:        'Base64 RSA Key Material (512+ chars)',
    // Long unbroken base64 strings are almost always encoded key material.
    // 512 chars ≈ 3072-bit key minimum. Short base64 in normal JSON/HTML is fine.
    regex:       /[A-Za-z0-9+/]{512,}={0,2}/,
    description: 'Long base64 string — likely encoded RSA/private key material. Review and remove.',
  },
];

// Files (by path relative to repo root) that are allowlisted from the content
// scan because they legitimately reference key format examples without containing
// actual private key material.
const CONTENT_ALLOWLIST = new Set([
  'scripts/sovereign-leak-guard.cjs', // Contains pattern strings for this scanner
  'scripts/scan-docs.cjs',            // Contains pattern strings for the docs scanner
]);

// File extensions to skip for content scanning (binary / compiled / lock files).
const SKIP_CONTENT_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.map', '.lock', '.zip', '.tar', '.gz', '.bin',
  '.db', '.sqlite', '.sql',
]);

// Maximum file size for content scanning (2 MB — larger files are likely generated).
const MAX_CONTENT_SCAN_BYTES = 2 * 1024 * 1024;

// Maximum file size for HAR scanning (20 MB — HAR captures can be large).
const MAX_HAR_SCAN_BYTES = 20 * 1024 * 1024;

// ── Gitignore parser ──────────────────────────────────────────────────────────

/**
 * Parse a .gitignore file and return all rules in order, preserving both
 * ignore patterns and negation (!) re-allow patterns.
 *
 * Gitignore semantics: the LAST matching rule wins. A `!foo` negation after a
 * `*.foo` rule re-allows files that were previously matched by `*.foo`.
 *
 * @param {string} filePath  Absolute path to the .gitignore file.
 * @returns {{ pattern: string, negate: boolean }[]}  Rules in declaration order.
 */
function parseGitignore(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    logAosError(AOS_ERROR.NOT_FOUND, `sovereign-leak-guard: cannot read ${filePath}: ${err.message}`);
    return [];
  }

  const rules = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    // Skip blank lines and comments.
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('!')) {
      // Negation rule — strips the leading `!`, keeps the rest as a pattern.
      rules.push({ pattern: trimmed.slice(1), negate: true });
    } else {
      rules.push({ pattern: trimmed, negate: false });
    }
  }
  return rules;
}

// ── Glob-to-regex converter ───────────────────────────────────────────────────

/**
 * Convert a .gitignore pattern to a RegExp that can be tested against file paths
 * as returned by `git ls-files` (POSIX-style, relative to repo root, no leading /).
 *
 * Follows the gitignore specification (simplified):
 *   - Trailing `/` means match only directories → we match any file under it.
 *   - A pattern without `/` (except trailing) matches at any depth (basename match).
 *   - A pattern with `/` inside matches relative to the repo root.
 *   - `*` matches anything except `/`.
 *   - `**` matches anything including `/`.
 *   - `?` matches any single character except `/`.
 *
 * @param {string} pattern  A single .gitignore pattern line (no leading `!`).
 * @returns {RegExp|null}   Compiled regex, or null if the pattern is empty.
 */
function patternToRegex(pattern) {
  if (!pattern) return null;

  const isDirectoryOnly = pattern.endsWith('/');
  let p = isDirectoryOnly ? pattern.slice(0, -1) : pattern;

  // Leading / anchors pattern to repo root; strip it before building regex.
  const hasLeadingSlash = p.startsWith('/');
  if (hasLeadingSlash) p = p.slice(1);

  // A pattern is "rooted" (must match from repo root) if it contains a slash
  // anywhere in the (stripped) pattern.
  const isRooted = hasLeadingSlash || p.includes('/');

  // Convert glob syntax to regex, escaping all other regex metacharacters.
  let reStr = '';
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === '*' && i + 1 < p.length && p[i + 1] === '*') {
      // `**` matches any sequence including path separators.
      reStr += '.*';
      i += 2;
      // Consume optional trailing slash after `**`.
      if (i < p.length && p[i] === '/') {
        reStr += '(/|$)';
        i++;
      }
    } else if (c === '*') {
      // `*` matches anything except `/`.
      reStr += '[^/]*';
      i++;
    } else if (c === '?') {
      // `?` matches any single character except `/`.
      reStr += '[^/]';
      i++;
    } else {
      // Escape all regex metacharacters in literal portions.
      reStr += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }

  if (isDirectoryOnly) {
    // A directory pattern matches the directory itself AND any file within it.
    reStr += '(/.*)?';
  }

  if (isRooted) {
    // Anchored to repo root: match from the start of the path.
    return new RegExp('^' + reStr + '$');
  } else {
    // Unrooted: match the pattern as a path component at any depth.
    // The `(^|/)` ensures we don't match partial directory names.
    return new RegExp('(^|/)' + reStr + '$');
  }
}

// ── Git tree reader ───────────────────────────────────────────────────────────

/**
 * Return the list of all files currently tracked in the git tree.
 * Uses `git ls-files` which only shows files the git index knows about —
 * i.e., files that have been committed or staged.
 *
 * @returns {string[]}  POSIX-style paths relative to repo root.
 */
function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (err) {
    logAosError(AOS_ERROR.INTERNAL_ERROR, `sovereign-leak-guard: git ls-files failed: ${err.message}`);
    return [];
  }
}

// ── Layer 1: Git-tree pattern check ──────────────────────────────────────────

/**
 * Check tracked files against gitignore rules using the LAST-RULE-WINS semantics
 * of the gitignore specification.
 *
 * A file is a violation only if the LAST rule that matches it is a non-negation
 * (ignore) rule. If the last matching rule is a negation (`!`), the file is
 * intentionally re-allowed and must NOT be reported as a violation.
 *
 * @param {string[]} trackedFiles  All files from git ls-files.
 * @param {{ pattern: string, negate: boolean }[]} rules  Parsed .gitignore rules.
 * @returns {{ file: string, pattern: string }[]}
 */
function checkTreeAgainstRules(trackedFiles, rules) {
  // Pre-compile all rules into regex objects for efficiency.
  const compiled = rules.map(({ pattern, negate }) => {
    const regex = patternToRegex(pattern);
    return regex ? { pattern, negate, regex } : null;
  }).filter(Boolean);

  const violations = [];

  for (const file of trackedFiles) {
    // Walk through ALL rules in order and track the last matching rule.
    let lastMatchingRule = null;
    for (const rule of compiled) {
      if (rule.regex.test(file)) {
        lastMatchingRule = rule;
        // Do NOT break — we need to find the LAST matching rule.
      }
    }

    // A violation occurs only when the last matching rule is an IGNORE rule
    // (not a negation/re-allow rule).
    if (lastMatchingRule && !lastMatchingRule.negate) {
      violations.push({ file, pattern: lastMatchingRule.pattern });
    }
  }

  return violations;
}

// ── Layer 2: Content secret scan ─────────────────────────────────────────────

/**
 * Scan a single tracked file for embedded secret patterns.
 *
 * @param {string} relPath  Path relative to repo root (from git ls-files).
 * @returns {{ file: string, pattern: string, description: string }[]}
 */
function scanFileContent(relPath) {
  // Skip allowlisted files.
  if (CONTENT_ALLOWLIST.has(relPath)) return [];

  const ext = path.extname(relPath).toLowerCase();
  if (SKIP_CONTENT_EXTENSIONS.has(ext)) return [];

  const absPath = path.join(REPO_ROOT, relPath);
  let stat;
  try { stat = fs.statSync(absPath); } catch { return []; }
  if (stat.size > MAX_CONTENT_SCAN_BYTES) return [];

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    // Likely a binary file that slipped past the extension check — skip it.
    return [];
  }

  const findings = [];
  for (const { name, regex, description } of CONTENT_SECRET_PATTERNS) {
    // Clone the regex to reset lastIndex for global patterns.
    if (new RegExp(regex.source, regex.flags).test(content)) {
      findings.push({ file: relPath, pattern: name, description });
    }
  }
  return findings;
}

// ── Layer 3: Key/Token filename auto-guard ────────────────────────────────────
// Uses shared configuration from sovereignGuardConfig.cjs

/**
 * Check whether a file path looks like a code file that is needed to run AveryOS™.
 * Returns true when the file should be EXEMPT from auto-gitignore.
 */
function isProtectedCodeFile(relPath) {
  const ext  = path.extname(relPath).toLowerCase();
  const norm = relPath.replace(/\\/g, '/');

  if (CODE_EXTENSIONS.has(ext)) return true;
  for (const dir of PROTECTED_DIRS) {
    if (norm.startsWith(dir)) return true;
  }
  return false;
}

/**
 * Check whether a filename contains "key" or "token" (case-insensitive).
 */
function filenameContainsKeyOrToken(relPath) {
  const base = path.basename(relPath).toLowerCase();
  return base.includes('key') || base.includes('token');
}

/**
 * Check whether a file's content looks like it contains actual key material.
 */
function contentLooksLikeKey(absPath) {
  let content;
  try {
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_CONTENT_SCAN_BYTES) return false;
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    return false;
  }
  for (const { regex } of KEY_CONTENT_PATTERNS) {
    if (new RegExp(regex.source, regex.flags).test(content)) return true;
  }
  return false;
}

/**
 * Check whether a pattern (or one that covers it) is already present in .gitignore.
 */
function isAlreadyGitignored(gitignorePath, pattern) {
  try {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    return content.split('\n').some(line => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return false;
      // Check exact match or whether existing pattern covers the new pattern
      return l === pattern || pattern.startsWith(l.replace(/\*/g, ''));
    });
  } catch {
    return false;
  }
}

/**
 * GATE 111.5.3 — Layer 3: Key/Token Filename Auto-Guard
 *
 * Scans ALL files in the repo directory (tracked + untracked) for filenames
 * that contain "key" or "token".  For each candidate:
 *   1. Skips protected code files (source code required to run AveryOS™).
 *   2. Checks the file content for actual cryptographic material.
 *   3. If key material is found AND the file is not already .gitignored,
 *      auto-appends the filename to .gitignore.
 *
 * Returns a list of files that were auto-added to .gitignore.
 *
 * @param {string} gitignorePath  Absolute path to .gitignore.
 * @param {boolean} dryRun        When true, log actions but do not write.
 * @returns {{ file: string, action: 'added' | 'already_ignored' | 'protected' | 'no_key_content' }[]}
 */
function runKeyTokenAutoGuard(gitignorePath, dryRun) {
  const results = [];

  // Collect all files under REPO_ROOT recursively (respects nothing — we scan everything)
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs  = path.join(dir, entry.name);
      const rel  = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
      // Skip .git directory and node_modules
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.open-next') continue;
      if (entry.isDirectory()) {
        walk(abs);
      } else if (filenameContainsKeyOrToken(rel)) {
        // Determine disposition
        if (isProtectedCodeFile(rel)) {
          results.push({ file: rel, action: 'protected' });
          continue;
        }
        if (!contentLooksLikeKey(abs)) {
          results.push({ file: rel, action: 'no_key_content' });
          continue;
        }
        // Check if already covered by .gitignore
        const basename = path.basename(rel);
        if (isAlreadyGitignored(gitignorePath, basename) || isAlreadyGitignored(gitignorePath, rel)) {
          results.push({ file: rel, action: 'already_ignored' });
          continue;
        }
        // Auto-append to .gitignore
        if (!dryRun) {
          fs.appendFileSync(
            gitignorePath,
            `\n# Auto-detected key/token file — added by sovereign-leak-guard\n${basename}\n`,
            'utf8',
          );
          logAosHeal(
            AOS_ERROR.INTERNAL_ERROR,
            `sovereign-leak-guard [Layer 3]: Auto-added '${basename}' to .gitignore — contains key material.`,
          );
        }
        results.push({ file: rel, action: 'added' });
      }
    }
  }

  walk(REPO_ROOT);
  return results;
}

// ── Layer 4: HAR file key-pattern auto-detection (Gate 113.5) ─────────────────
// Scans all tracked .har files for Authorization headers, Bearer tokens, API
// keys, and private key material embedded in request/response entries.
// HAR (HTTP Archive) files capture full request/response cycles and can expose
// sensitive credentials if committed accidentally.
//
// Detection targets (inside HAR entry headers and postData):
//   - Authorization: Bearer <token>
//   - Authorization: Basic <base64>
//   - x-api-key / x-vault-auth / x-auth-token headers with non-empty values
//   - Stripe live keys (sk_live_...)
//   - GitHub PATs (ghp_...)
//   - Private key PEM blocks
//   - Long base64 blobs (≥ 256 chars) in postData (potential key material)

const HAR_KEY_PATTERNS = [
  {
    name:  'Authorization Bearer Token',
    regex: /"authorization"\s*:\s*"bearer\s+[a-z0-9\-._~+/]{8,}"/i,
    description: 'Bearer token in HAR Authorization header — may expose API or vault credentials.',
  },
  {
    name:  'Authorization Basic Credentials',
    regex: /"authorization"\s*:\s*"basic\s+[a-z0-9+/]{8,}={0,2}"/i,
    description: 'Basic auth credentials in HAR Authorization header — may expose username:password.',
  },
  {
    name:  'x-api-key / x-vault-auth / x-auth-token header',
    regex: /"(x-api-key|x-vault-auth|x-auth-token)"\s*:\s*"[^"]{8,}"/i,
    description: 'API key or vault auth token present in HAR headers — rotate if sensitive.',
  },
  {
    name:  'Stripe Live Secret Key in HAR',
    regex: /sk_live_[0-9a-zA-Z]{24,}/,
    description: 'Stripe LIVE secret key found in HAR — revoke immediately at https://dashboard.stripe.com/apikeys',
  },
  {
    name:  'GitHub PAT in HAR',
    regex: /ghp_[0-9a-zA-Z]{36,}/,
    description: 'GitHub Personal Access Token found in HAR — revoke at https://github.com/settings/tokens',
  },
  {
    name:  'PEM Private Key Block in HAR',
    regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    description: 'Private key PEM block embedded in HAR traffic — rotate the key immediately.',
  },
  {
    name:  'Long base64 blob in HAR postData (≥256 chars)',
    regex: /[A-Za-z0-9+/]{256,}={0,2}/,
    description: 'Large base64-encoded blob in HAR postData — may contain encoded key material.',
  },
];

/**
 * GATE 113.5 — Layer 4: HAR File Key-Pattern Auto-Detection
 *
 * Scans all tracked .har files for credential and key material patterns.
 * HAR files are JSON archives of HTTP traffic that commonly expose API keys,
 * Authorization headers, and other secrets when uploaded or committed.
 *
 * @param {string[]} trackedFiles  List of tracked files (relative paths, from git ls-files).
 * @returns {{ file: string, pattern: string, description: string }[]}
 */
function scanHarFiles(trackedFiles) {
  /** @type {{ file: string, pattern: string, description: string }[]} */
  const findings = [];

  const harFiles = trackedFiles.filter(f => f.toLowerCase().endsWith('.har'));
  if (harFiles.length === 0) return findings;

  for (const relPath of harFiles) {
    const absPath = path.join(REPO_ROOT, relPath);
    let content;
    try {
      const stat = fs.statSync(absPath);
      // Skip files larger than MAX_HAR_SCAN_BYTES to avoid OOM on massive capture files
      if (stat.size > MAX_HAR_SCAN_BYTES) {
        console.warn(`[Layer 4] Skipping large HAR file (${(stat.size / 1024 / 1024).toFixed(1)} MB): ${relPath}`);
        continue;
      }
      content = fs.readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    for (const { name, regex, description } of HAR_KEY_PATTERNS) {
      if (new RegExp(regex.source, regex.flags).test(content)) {
        findings.push({ file: relPath, pattern: name, description });
      }
    }
  }

  return findings;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('⛓️⚓⛓️  AveryOS™ Sovereign Leak Guard — dynamic git-tree protection');
  console.log('   Rule: Do NOT remove or weaken this gate. CreatorLock: Jason Lee Avery (ROOT0)\n');

  const gitignorePath = path.join(REPO_ROOT, '.gitignore');

  // ── Parse .gitignore ─────────────────────────────────────────────────────
  const rules = parseGitignore(gitignorePath);
  if (rules.length === 0) {
    logAosError(AOS_ERROR.NOT_FOUND, 'sovereign-leak-guard: .gitignore is empty or unreadable — aborting.');
    process.exit(1);
  }
  const ignoreRuleCount  = rules.filter(r => !r.negate).length;
  const negationRuleCount = rules.filter(r => r.negate).length;
  console.log(`[Layer 1] Loaded ${rules.length} rule(s) from .gitignore ` +
    `(${ignoreRuleCount} ignore, ${negationRuleCount} negation/allow)`);

  // ── Get tracked files ────────────────────────────────────────────────────
  const trackedFiles = getTrackedFiles();
  if (trackedFiles.length === 0) {
    console.log('[sovereign-leak-guard] No tracked files found — git ls-files returned empty.');
    process.exit(0);
  }
  console.log(`[Layer 1] Checking ${trackedFiles.length} tracked file(s) against .gitignore rules`);
  console.log(`[Layer 2] Scanning tracked files for embedded secret patterns`);
  console.log(`[Layer 3] Scanning all files for key/token filenames with key material`);
  console.log(`[Layer 4] Scanning tracked .har files for embedded key/credential patterns\n`);

  // ── Layer 1: Pattern violations ──────────────────────────────────────────
  const patternViolations = checkTreeAgainstRules(trackedFiles, rules);

  // ── Layer 2: Content violations ──────────────────────────────────────────
  const contentViolations = [];
  for (const file of trackedFiles) {
    const findings = scanFileContent(file);
    contentViolations.push(...findings);
  }

  // ── Layer 3: Key/Token filename auto-guard ───────────────────────────────
  const layer3Results = runKeyTokenAutoGuard(gitignorePath, DRY_RUN);
  const autoAdded     = layer3Results.filter(r => r.action === 'added');
  const alreadyIgnored = layer3Results.filter(r => r.action === 'already_ignored');
  const protectedFiles  = layer3Results.filter(r => r.action === 'protected');

  if (autoAdded.length > 0) {
    console.log(`✅ [Layer 3] Auto-added ${autoAdded.length} key/token file(s) to .gitignore:`);
    for (const { file } of autoAdded) {
      console.log(`   + ${file}`);
    }
  }
  if (alreadyIgnored.length > 0) {
    console.log(`ℹ️  [Layer 3] ${alreadyIgnored.length} key/token file(s) already covered by .gitignore.`);
  }
  if (protectedFiles.length > 0) {
    console.log(`ℹ️  [Layer 3] ${protectedFiles.length} key/token filename(s) skipped — protected source code files.`);
  }
  if (autoAdded.length === 0 && alreadyIgnored.length === 0) {
    console.log(`✅ [Layer 3] No unprotected key/token files found.`);
  }

  // ── Layer 4: HAR file key-pattern scan (Gate 113.5) ──────────────────────
  const harViolations = scanHarFiles(trackedFiles);
  if (harViolations.length > 0) {
    console.log(`⚠️  [Layer 4] ${harViolations.length} .har file(s) contain key/credential patterns.`);
  } else {
    console.log(`✅ [Layer 4] HAR file scan passed — no key patterns detected in tracked .har files.`);
  }

  const totalViolations = patternViolations.length + contentViolations.length + harViolations.length;

  // ── Report ────────────────────────────────────────────────────────────────
  if (patternViolations.length > 0) {
    console.error(`\n❌ [Layer 1] ${patternViolations.length} file(s) are tracked in git but match .gitignore patterns:\n`);
    for (const { file, pattern } of patternViolations) {
      console.error(`  ⛔  ${file}`);
      console.error(`       Matched pattern: ${pattern}`);
    }
    console.error('\n  Remediation:');
    console.error('    git rm --cached <file>   # untrack the file (keeps it on disk)');
    console.error('    git commit -m "Remove private/ignored file from git tree"');
    console.error('    # If the file contains secrets: rotate ALL affected credentials immediately.');
    console.error('    # If it was committed historically: use git filter-repo to purge history.\n');
  }

  if (contentViolations.length > 0) {
    console.error(`\n❌ [Layer 2] ${contentViolations.length} tracked file(s) contain embedded secret patterns:\n`);
    for (const { file, pattern, description } of contentViolations) {
      console.error(`  ⛔  ${file}`);
      console.error(`       Pattern: ${pattern}`);
      console.error(`       Note:    ${description}`);
    }
    console.error('\n  Remediation:');
    console.error('    Remove the secret from the file, then run:');
    console.error('    git rm --cached <file> && git commit -m "Remove secret from tracked file"');
    console.error('    # CRITICAL: Rotate ALL leaked credentials immediately.\n');
  }

  if (harViolations.length > 0) {
    console.error(`\n❌ [Layer 4] ${harViolations.length} .har file(s) contain key/credential patterns:\n`);
    for (const { file, pattern, description } of harViolations) {
      console.error(`  ⛔  ${file}`);
      console.error(`       Pattern: ${pattern}`);
      console.error(`       Note:    ${description}`);
    }
    console.error('\n  Remediation:');
    console.error('    Remove the .har file from git tracking and rotate any exposed credentials:');
    console.error('    git rm --cached <file>.har && git commit -m "Remove HAR file with credentials"');
    console.error('    # CRITICAL: Rotate ALL credentials found in the HAR file immediately.\n');
  }

  if (totalViolations === 0) {
    console.log('✅ [Layer 1] Git-tree pattern guard passed — no .gitignore-d files are tracked.');
    console.log(`✅ [Layer 2] Content guard passed — no secret patterns found in ${trackedFiles.length} tracked files.`);
    console.log(`✅ [Layer 3] Key/token auto-guard passed — ${autoAdded.length} file(s) auto-added to .gitignore.`);
    console.log(`✅ [Layer 4] HAR key-pattern guard passed — no credentials found in tracked .har files.`);
    logAosHeal(AOS_ERROR.INTERNAL_ERROR,
      `sovereign-leak-guard: clean — ${trackedFiles.length} files checked, 0 violations, ${autoAdded.length} auto-added to .gitignore.`);
    process.exit(0);
  }

  // ── Failure ───────────────────────────────────────────────────────────────
  logAosError(AOS_ERROR.INVALID_FIELD,
    `sovereign-leak-guard: ${totalViolations} violation(s) — ` +
    `${patternViolations.length} tree pattern(s), ${contentViolations.length} content secret(s), ${harViolations.length} HAR credential(s).`);

  console.error(`\n⛓️⚓⛓️  Sovereign Leak Guard FAILED — ${totalViolations} violation(s) detected.`);

  if (DRY_RUN) {
    console.log('\n[sovereign-leak-guard] --dry-run: violations reported but exit code is 0.');
    process.exit(0);
  }

  process.exit(1);
}

main();
