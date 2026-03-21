#!/usr/bin/env node
/**
 * scripts/generate-docs.cjs
 *
 * AveryOS™ Auto-Documentation Engine — Phase 107.2 (GATE 107.2)
 *
 * Extracts logic patterns from all TypeScript/JavaScript source files and
 * generates high-fidelity, IP-safe documentation in /public/admin/docs/.
 *
 * Rules:
 *   1. Only extract PUBLIC API surface: exported functions, interfaces, constants.
 *   2. NEVER include implementation details, internal algorithms, or private logic.
 *   3. NEVER include hardcoded secrets, kernel-anchored values, or capsule payloads.
 *   4. Generate Markdown + JSON index for each module.
 *   5. Auto-update on every successful `build:cloudflare` run.
 *
 * Integration: Called in npm run build:cloudflare pipeline after capsule compilation.
 *
 * Output: public/admin/docs/<module-path>.md  +  public/admin/docs/index.json
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT     = path.resolve(__dirname, "..");
const OUT_DIR  = path.join(ROOT, "public", "admin", "docs");
const SRC_DIRS = [
  "lib",
  "app/api",
];

// Patterns of content that must NEVER appear in generated docs
const PRIVATE_IP_PATTERNS = [
  /KERNEL_SHA\s*=\s*["'`][a-f0-9]{128}/i,  // hardcoded kernel SHA
  /VAULT_PASSPHRASE/i,
  /STRIPE_SECRET/i,
  /FIREBASE_PRIVATE_KEY/i,
  /FCM_DEVICE_TOKEN/i,
  /\.aoskey|\.aosvault|\.aosmem/i,
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Scan a directory recursively for .ts / .tsx files.
 * @param {string} dir
 * @returns {string[]}
 */
function scanTs(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      results.push(...scanTs(path.join(dir, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

/**
 * Extract exported symbols (functions, interfaces, constants, types) from source.
 * Returns only the public API surface — never internal implementations.
 *
 * @param {string} src  File source content
 * @returns {{ name: string; kind: string; description: string }[]}
 */
function extractPublicApi(src) {
  const symbols = [];

  // Remove block comments to avoid false positives in implementation
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "");

  // Exported function declarations
  const fnRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  let m;
  while ((m = fnRe.exec(stripped)) !== null) {
    const name = m[1];
    // Get the JSDoc comment immediately preceding the export (up to 800 chars back)
    const preceding = src.slice(Math.max(0, m.index - 800), m.index);
    const jsdoc = extractJsdoc(preceding);
    symbols.push({ name, kind: "function", description: jsdoc });
  }

  // Exported const / let declarations
  const constRe = /export\s+const\s+(\w+)\s*[=:]/g;
  while ((m = constRe.exec(stripped)) !== null) {
    const name = m[1];
    const preceding = src.slice(Math.max(0, m.index - 400), m.index);
    const jsdoc = extractJsdoc(preceding);
    symbols.push({ name, kind: "constant", description: jsdoc });
  }

  // Exported interfaces
  const ifaceRe = /export\s+interface\s+(\w+)/g;
  while ((m = ifaceRe.exec(stripped)) !== null) {
    const name = m[1];
    const preceding = src.slice(Math.max(0, m.index - 400), m.index);
    const jsdoc = extractJsdoc(preceding);
    symbols.push({ name, kind: "interface", description: jsdoc });
  }

  // Exported types
  const typeRe = /export\s+type\s+(\w+)\s*=/g;
  while ((m = typeRe.exec(stripped)) !== null) {
    const name = m[1];
    symbols.push({ name, kind: "type", description: "" });
  }

  return symbols;
}

/**
 * Extract the last JSDoc block from a string.
 * Returns a cleaned single-line description.
 *
 * @param {string} src
 * @returns {string}
 */
function extractJsdoc(src) {
  const match = src.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
  if (!match) return "";
  const raw = (match[1] ?? "")
    .replace(/^\s*\*\s?/gm, "")  // strip leading " * "
    .trim();
  // Take first paragraph only (up to first blank line or @param)
  const firstPara = raw.split(/\n\n|@param|@returns|@throws/)[0] ?? "";
  return firstPara.replace(/\n/g, " ").trim();
}

/**
 * Check source content for private IP patterns.
 * Returns true if the content is safe to document.
 *
 * @param {string} content
 * @returns {boolean}
 */
function isSafeToDocument(content) {
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(content)) return false;
  }
  return true;
}

/**
 * Generate a Markdown document for a module.
 *
 * @param {string} relPath  Relative path from ROOT
 * @param {{ name: string; kind: string; description: string }[]} symbols
 * @returns {string}
 */
function generateModuleDoc(relPath, symbols) {
  const moduleName = relPath.replace(/\\/g, "/").replace(/\.(ts|tsx)$/, "");
  const lines = [
    `# \`${moduleName}\``,
    "",
    `> Auto-generated documentation. Source: \`${relPath}\``,
    `> Generated by AveryOS™ Auto-Documentation Engine (Phase 107.2).`,
    `> **IP Notice**: Implementation details are proprietary and not included.`,
    "",
    "## Public API",
    "",
  ];

  if (symbols.length === 0) {
    lines.push("*No exported symbols detected.*");
  } else {
    for (const sym of symbols) {
      lines.push(`### \`${sym.name}\` *(${sym.kind})*`);
      if (sym.description) {
        lines.push("", sym.description, "");
      } else {
        lines.push("");
      }
    }
  }

  lines.push(
    "---",
    "",
    `*⛓️⚓⛓️ AveryOS™ Sovereign Integrity License v1.0 — All implementations are proprietary.*`,
  );

  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log("[generate-docs] Starting AveryOS™ Auto-Documentation Engine…");

  // Ensure output directory exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const index = {
    generated_at: new Date().toISOString(),
    modules: [],
  };

  let processedCount = 0;
  let skippedCount   = 0;

  for (const srcDir of SRC_DIRS) {
    const absDir = path.join(ROOT, srcDir);
    const files  = scanTs(absDir);

    for (const file of files) {
      const relPath = path.relative(ROOT, file).replace(/\\/g, "/");
      const src     = fs.readFileSync(file, "utf8");

      // Skip if file contains private IP patterns
      if (!isSafeToDocument(src)) {
        console.log(`[generate-docs]   SKIP (private IP detected): ${relPath}`);
        skippedCount++;
        continue;
      }

      const symbols  = extractPublicApi(src);
      const docMd    = generateModuleDoc(relPath, symbols);

      // Write module doc
      const outFile = path.join(OUT_DIR, relPath.replace(/\.(ts|tsx)$/, ".md"));
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      const fdDoc = fs.openSync(outFile, 'w');
      try { fs.writeSync(fdDoc, docMd); } finally { fs.closeSync(fdDoc); }

      index.modules.push({
        path:        relPath,
        doc:         path.relative(path.join(ROOT, "public"), outFile).replace(/\\/g, "/"),
        symbolCount: symbols.length,
        symbols:     symbols.map((s) => ({ name: s.name, kind: s.kind })),
      });

      processedCount++;
    }
  }

  // Write index.json
  const indexPath = path.join(OUT_DIR, "index.json");
  const fdIndex = fs.openSync(indexPath, 'w');
  try { fs.writeSync(fdIndex, JSON.stringify(index, null, 2)); } finally { fs.closeSync(fdIndex); }

  console.log(`[generate-docs] Complete — ${processedCount} modules documented, ${skippedCount} skipped (private IP).`);
  console.log(`[generate-docs] Index: ${path.relative(ROOT, indexPath)}`);
}

main();
