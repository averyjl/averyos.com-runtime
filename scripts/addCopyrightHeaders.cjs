#!/usr/bin/env node
/**
 * scripts/addCopyrightHeaders.cjs
 *
 * AveryOS™ Copyright Header Engine — Permanent Protection Protocol
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 *
 * PURPOSE
 * -------
 * Scans all source files in the repository and injects the AveryOS™
 * copyright header block at the top of each file (after shebang/directives).
 *
 * Copyright Block Source:
 *   9-5-2025_AveryOS_CopyrightBlock_v1.0.txt
 *   SHA-512: 8c084898db278a448aa626312a7cb44716fe9aab589033323f51abe32ed2b147d61162e32678044b1d8c657420d3a1e15f789467c5ee071d1a9f6c197308d164
 *
 * RULES
 * -----
 * - Idempotent: will NOT re-add the header if it already contains the copyright marker.
 * - Respects shebangs (#!) — inserts after the first line if it starts with #!
 * - Respects "use client"/"use server" directives — inserts after them
 * - Skips binary files, generated files (public/manifest/), .next/, node_modules/
 * - Skips private sovereign files (*.aoskey, *.aosvault, etc.)
 * - Runs in dry-run mode by default when called with --dry-run
 * - In CI, called without --dry-run to enforce copyright on all files
 *
 * USAGE
 * -----
 *   node scripts/addCopyrightHeaders.cjs              # apply to all files
 *   node scripts/addCopyrightHeaders.cjs --dry-run    # report only, no writes
 *   node scripts/addCopyrightHeaders.cjs --check      # exit 1 if any file missing copyright
 *
 * ⛓️⚓⛓️
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const CHECK   = process.argv.includes('--check');

const COPYRIGHT_MARKER = 'AveryOS_CopyrightBlock_v1.0';

/** Short copyright line for source code comments */
const COPYRIGHT_LINE =
  '© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved. ' +
  'Licensed under AveryOS Sovereign Integrity License v1.0. ' +
  'Subject to Creator Lock and Sovereign Kernel Governance. ' +
  'Unauthorized use, duplication, or derivative work is prohibited. ' +
  '(AveryOS_CopyrightBlock_v1.0)';

/** File extensions that get copyright blocks */
const ELIGIBLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass',
  '.md',
  // Note: .json excluded — JSON does not support comments
  '.toml',
  '.yaml', '.yml',
  '.sh',
  '.html',
]);

/** Directories to skip entirely */
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.open-next', '.git',
  'public/manifest', '.github/agents',
  'backups', 'logs',
  'functions',  // Firebase functions — separate package
  'VaultEcho',  // git submodule
]);

/** File patterns to skip */
const SKIP_PATTERNS = [
  /\.(aoskey|aosvault|aosmem|vccaps|aoscap|avery)$/i,
  /SKC.*\.(json|yaml|yml|lock)$/i,
  /SST.*\.(json|yaml|yml|lock)$/i,
  /KC.*\.(json|yaml|yml|lock)$/i,
  /ClockGate.*\.json$/i,
  /\.anchor-salt$/i,
  /package-lock\.json$/,
  /\.min\.(js|css)$/,
  /\.map$/,
];

/** Files that are auto-generated and should not be modified */
const GENERATED_FILES = new Set([
  'public/robots.txt',
  'public/sitemap.xml',
  'next-env.d.ts',
]);

// ── Comment style by file type ────────────────────────────────────────────────

function getCommentBlock(ext, copyrightLine) {
  switch (ext) {
    case '.css':
    case '.scss':
    case '.sass':
      return `/*\n * ${copyrightLine}\n */\n`;
    case '.html':
      return `<!-- ${copyrightLine} -->\n`;
    case '.md':
      return `<!-- ${copyrightLine} -->\n`;
    case '.sh':
      return `# ${copyrightLine}\n`;
    case '.yaml':
    case '.yml':
      return `# ${copyrightLine}\n`;
    case '.toml':
      return `# ${copyrightLine}\n`;
    default:
      // TypeScript, JavaScript, JSX, etc.
      return `// ${copyrightLine}\n`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldSkip(relPath) {
  // Skip generated files
  if (GENERATED_FILES.has(relPath)) return true;
  // Skip patterns
  if (SKIP_PATTERNS.some((p) => p.test(relPath))) return true;
  // Skip dirs
  const parts = relPath.split(path.sep);
  for (const part of parts.slice(0, -1)) {
    if (SKIP_DIRS.has(part)) return true;
    // Skip path segments that match generated manifest directories
    if (relPath.startsWith('public' + path.sep + 'manifest')) return true;
  }
  return false;
}

/** Collect all eligible files under root */
function collectFiles(dir, collected = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel  = path.relative(ROOT, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (rel.startsWith('public' + path.sep + 'manifest')) continue;
      collectFiles(full, collected);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ELIGIBLE_EXTENSIONS.has(ext)) continue;
      if (shouldSkip(rel)) continue;
      collected.push(full);
    }
  }
  return collected;
}

/** Return the copyright header string for a given file, or null to skip */
function buildHeader(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return getCommentBlock(ext, COPYRIGHT_LINE);
}

/** Inject copyright header into a source file */
function injectHeader(filePath, header) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Already has copyright marker?
  if (content.includes(COPYRIGHT_MARKER)) return false;

  // Split into lines to handle shebang / directives
  const lines = content.split('\n');
  let insertAt = 0;

  // Skip shebang line
  if (lines[0] && lines[0].startsWith('#!')) {
    insertAt = 1;
  }
  // Skip "use client" / "use server" directives (Next.js)
  if (lines[insertAt] && /^["']use (client|server)["'];?$/.test(lines[insertAt].trim())) {
    insertAt++;
    // Skip blank line after directive
    if (lines[insertAt] !== undefined && lines[insertAt].trim() === '') insertAt++;
  }

  const before = lines.slice(0, insertAt).join('\n');
  const after  = lines.slice(insertAt).join('\n');

  const newContent = insertAt === 0
    ? header + '\n' + content
    : before + '\n' + header + '\n' + after;

  if (DRY_RUN || CHECK) return true; // report intent only

  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const files = collectFiles(ROOT);

  let modified = 0;
  let skipped  = 0;
  let missing  = [];

  for (const filePath of files) {
    const rel    = path.relative(ROOT, filePath);
    const header = buildHeader(filePath);

    if (!header) {
      skipped++;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(COPYRIGHT_MARKER)) {
      // Already has it
      continue;
    }

    missing.push(rel);

    if (!DRY_RUN && !CHECK) {
      const injected = injectHeader(filePath, header);
      if (injected) {
        modified++;
        console.log(`  ✅ injected: ${rel}`);
      }
    } else {
      console.log(`  📋 needs header: ${rel}`);
    }
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`📋 DRY RUN: ${missing.length} files need copyright header. ${skipped} skipped (JSON/binary).`);
  } else if (CHECK) {
    if (missing.length > 0) {
      console.error(`❌ CHECK FAILED: ${missing.length} files are missing the AveryOS™ copyright header.`);
      console.error('   Run: node scripts/addCopyrightHeaders.cjs');
      process.exit(1);
    } else {
      console.log(`✅ CHECK PASSED: All eligible files have the AveryOS™ copyright header.`);
    }
  } else {
    console.log(`✅ Copyright headers applied: ${modified} files updated. ${skipped} skipped (JSON/binary).`);
  }
}

main();
