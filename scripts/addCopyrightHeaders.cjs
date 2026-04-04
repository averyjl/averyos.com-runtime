#!/usr/bin/env node
/**
 * scripts/addCopyrightHeaders.cjs
 *
 * Adds the AveryOS™ copyright header block to all TS/TSX/JS/CSS source files
 * that do not already have it. Also supports a --check mode for CI enforcement.
 *
 * Usage:
 *   node scripts/addCopyrightHeaders.cjs          # stamp all files
 *   node scripts/addCopyrightHeaders.cjs --check  # exit 1 if any file is missing the header
 *
 * ⛓️⚓⛓️  © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";
const fs   = require("fs");
const path = require("path");

// ── Copyright header text ──────────────────────────────────────────────────────
const HEADER_JS = `/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
`;

const HEADER_CSS = `/*
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
`;

// A short signature used to detect whether the header is already present
const HEADER_SIGNATURE = "© 1992–2026 Jason Lee Avery / AveryOS™";

// ── Directories and extensions to process ─────────────────────────────────────
const ROOT_DIR = path.resolve(__dirname, "..");

const INCLUDE_DIRS  = ["app", "components", "lib", "pages", "scripts", "styles"];
const JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs"]);
const CSS_EXTENSIONS = new Set([".css"]);

// Patterns for files / directories to skip entirely
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.open-next/,
  /\.git/,
  /\/dist\//,
  /\/build\//,
  // Auto-generated files
  /robots\.ts$/,
  /sitemap\.xml$/,
  /sitemap\.ts$/,
  // Migration relics
  /\.migrated$/,
  // Test stubs (let jest handle those)
  /__tests__/,
  /\.test\./,
  /\.spec\./,
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Walk a directory recursively, calling `cb` for every regular file. */
function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (SKIP_PATTERNS.some((p) => p.test(fullPath))) continue;
    if (entry.isDirectory()) {
      walk(fullPath, cb);
    } else if (entry.isFile()) {
      cb(fullPath);
    }
  }
}

/** Return the copyright header appropriate for the file extension, or null to skip. */
function headerFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (JS_EXTENSIONS.has(ext)) return HEADER_JS;
  if (CSS_EXTENSIONS.has(ext)) return HEADER_CSS;
  return null;
}

/** True if the file already contains the copyright signature. */
function hasHeader(content) {
  return content.includes(HEADER_SIGNATURE);
}

/**
 * Insert the header at the correct position:
 * - After the shebang line (`#!/…`) if present
 * - After the `"use client"` / `"use server"` directive if present
 * - At the very top otherwise
 */
function insertHeader(content, header) {
  const lines = content.split("\n");
  let insertAt = 0;

  // Skip shebang
  if (lines[0] && lines[0].startsWith("#!")) insertAt = 1;

  // Skip "use client" / "use server" / "use strict" directive
  const directiveLine = lines[insertAt] ?? "";
  if (/^["']use (client|server|strict)["']/.test(directiveLine.trim())) {
    insertAt += 1;
    // Also skip any blank line after the directive
    if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
  }

  lines.splice(insertAt, 0, header.trimEnd()); // trimEnd to avoid double blank line
  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────────

const CHECK_MODE = process.argv.includes("--check");

let stamped  = 0;
let skipped  = 0;
let missing  = []; // only populated in --check mode
let alreadyOk = 0;

for (const dir of INCLUDE_DIRS) {
  const fullDir = path.join(ROOT_DIR, dir);
  if (!fs.existsSync(fullDir)) continue;

  walk(fullDir, (filePath) => {
    const header = headerFor(filePath);
    if (!header) { skipped++; return; }

    const original = fs.readFileSync(filePath, "utf8");

    if (hasHeader(original)) {
      alreadyOk++;
      return;
    }

    if (CHECK_MODE) {
      missing.push(path.relative(ROOT_DIR, filePath));
      return;
    }

    const updated = insertHeader(original, header);
    fs.writeFileSync(filePath, updated, "utf8");
    stamped++;
    console.log(`  ✅ stamped: ${path.relative(ROOT_DIR, filePath)}`);
  });
}

if (CHECK_MODE) {
  if (missing.length === 0) {
    console.log("✅ All source files contain the AveryOS™ copyright header.");
    process.exit(0);
  } else {
    console.error(`❌ ${missing.length} file(s) are missing the AveryOS™ copyright header:\n`);
    missing.forEach((f) => console.error(`   • ${f}`));
    console.error("\nRun: node scripts/addCopyrightHeaders.cjs");
    process.exit(1);
  }
} else {
  console.log(`\n⛓️ AveryOS™ Copyright Stamp Complete:`);
  console.log(`   Stamped  : ${stamped}`);
  console.log(`   Already ✓: ${alreadyOk}`);
  console.log(`   Skipped  : ${skipped}`);
}
