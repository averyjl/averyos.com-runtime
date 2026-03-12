#!/usr/bin/env node
/**
 * scripts/qaTestGenerator.cjs
 *
 * AveryOS™ Sovereign QA Test Generator — Phase 112 / GATE 112.6
 *
 * Scans all TypeScript source files under lib/ and app/api/v1/ to detect
 * exported symbols that do not yet have test coverage in __tests__/.
 * For each uncovered module, it emits a test skeleton file to
 * __tests__/generated/ with stub tests for every exported function/constant.
 *
 * This script can be used to:
 *   1. Retroactively generate test coverage for legacy modules.
 *   2. Auto-generate test stubs for newly added lib/ modules.
 *   3. Enforce 100% coverage policy — CI can diff __tests__/generated/ to detect gaps.
 *
 * Usage:
 *   node scripts/qaTestGenerator.cjs [--dry-run] [--verbose]
 *
 * Flags:
 *   --dry-run   Print what would be generated without writing files.
 *   --verbose   Print every scanned file including those already covered.
 *   --force     Overwrite existing generated test files.
 *
 * Output:
 *   __tests__/generated/<module-path>.gen.test.ts  (one file per module)
 *   __tests__/generated/_coverage_report.json       (machine-readable gap report)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT        = path.resolve(__dirname, "..");
const LIB_DIR     = path.join(ROOT, "lib");
const TESTS_DIR   = path.join(ROOT, "__tests__");
const GEN_DIR     = path.join(TESTS_DIR, "generated");
const API_DIR     = path.join(ROOT, "app", "api", "v1");

const DRY_RUN  = process.argv.includes("--dry-run");
const VERBOSE  = process.argv.includes("--verbose");
const FORCE    = process.argv.includes("--force");

// ── Logging ───────────────────────────────────────────────────────────────────

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const MUTED  = "\x1b[90m";
const RED    = "\x1b[31m";

function log(msg)     { console.log(`${CYAN}[QA-GEN]${RESET} ${msg}`); }
function ok(msg)      { console.log(`${GREEN}[QA-GEN]${RESET} ${msg}`); }
function warn(msg)    { console.log(`${YELLOW}[QA-GEN]${RESET} ${msg}`); }
function verbose(msg) { if (VERBOSE) console.log(`${MUTED}[QA-GEN]${RESET} ${msg}`); }

// ── File discovery ────────────────────────────────────────────────────────────

/**
 * Recursively find all .ts files under a directory,
 * excluding .test.ts and .d.ts files.
 */
function findSourceFiles(dir, base = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(full, base));
    } else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.endsWith(".gen.test.ts")
    ) {
      results.push(path.relative(base, full).replace(/\\/g, "/"));
    }
  }
  return results;
}

/**
 * Find all existing test files under __tests__/ (excluding generated/).
 * Returns a set of module-base names that are already covered.
 */
function findCoveredModules() {
  const covered = new Set();
  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "generated") {
        scanDir(full);
      } else if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.cjs")) {
        const base = entry.name.replace(/\.(test\.ts|test\.cjs)$/, "");
        covered.add(base.toLowerCase());
      }
    }
  };
  scanDir(TESTS_DIR);
  return covered;
}

// ── Export extraction ─────────────────────────────────────────────────────────

/**
 * Parse a TypeScript source file and extract exported symbol names.
 * Uses simple regex-based extraction (no full AST parsing).
 */
function extractExports(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const exports = [];

  // Match: export function foo(...) / export async function foo
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is hardcoded for TypeScript export syntax detection
  const fnRx = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  let m;
  while ((m = fnRx.exec(src)) !== null) exports.push({ kind: "function", name: m[1] });

  // Match: export const foo = ... / export const FOO_BAR = ...
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is hardcoded for TypeScript export syntax detection
  const constRx = /^export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  while ((m = constRx.exec(src)) !== null) exports.push({ kind: "const", name: m[1] });

  // Match: export interface Foo / export type Foo
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is hardcoded for TypeScript export syntax detection
  const typeRx = /^export\s+(?:interface|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  while ((m = typeRx.exec(src)) !== null) exports.push({ kind: "type", name: m[1] });

  // Match: export class Foo
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is hardcoded for TypeScript export syntax detection
  const classRx = /^export\s+(?:default\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  while ((m = classRx.exec(src)) !== null) exports.push({ kind: "class", name: m[1] });

  return exports;
}

// ── Test skeleton generator ───────────────────────────────────────────────────

/**
 * Generate a test skeleton for a given module.
 * @param {string} relPath   Relative path from lib/ (e.g. "qa/engine.ts")
 * @param {string} absPath   Absolute filesystem path to the source file
 * @param {{ kind: string, name: string }[]} exports
 * @returns {string}  Generated test file content
 */
function generateTestSkeleton(relPath, absPath, exports, sourceRoot) {
  const modName  = path.basename(relPath, ".ts");
  const relImport = path.relative(path.join(ROOT, "__tests__", "generated"), absPath)
    .replace(/\\/g, "/")
    .replace(/\.ts$/, "");

  const sha512Input = fs.readFileSync(absPath, "utf8");
  const moduleSha   = crypto.createHash("sha512").update(sha512Input).digest("hex");

  const testableExports = exports.filter(e => e.kind === "function" || e.kind === "const" || e.kind === "class");
  const importedNames   = testableExports.map(e => e.name);
  const importLine      = importedNames.length > 0
    ? `import {\n  ${importedNames.join(",\n  ")},\n} from "${relImport}";`
    : `// No testable exports found in ${relPath}`;

  const tests = testableExports.map((exp) => {
    if (exp.kind === "function") {
      return `  test("${exp.name}() — TODO: add assertions", () => {
    // AUTOGENERATED STUB — fill in assertions for ${exp.name}
    // assert.ok(typeof ${exp.name} === "function");
    assert.ok(true, "Stub: implement this test");
  });`;
    }
    if (exp.kind === "const") {
      return `  test("${exp.name} — is defined and non-null", () => {
    // AUTOGENERATED STUB — verify ${exp.name} has the expected shape/value
    assert.ok(${exp.name} !== undefined && ${exp.name} !== null, "${exp.name} should be defined");
  });`;
    }
    return `  test("${exp.name} — TODO: add class test", () => {
    assert.ok(typeof ${exp.name} !== "undefined", "${exp.name} class should be defined");
  });`;
  });

  const describes = tests.length > 0
    ? `describe("${modName}", () => {\n${tests.join("\n\n")}\n});`
    : `// No testable exports found — this file may be types-only.`;

  return `/**
 * __tests__/generated/${modName}.gen.test.ts
 *
 * AUTO-GENERATED TEST SKELETON
 * Source: ${relPath}
 * Module SHA-512: ${moduleSha.slice(0, 32)}…
 *
 * Generated by scripts/qaTestGenerator.cjs
 * DO NOT EDIT MANUALLY — re-run 'npm run qa:generate' to refresh.
 *
 * All tests marked "TODO" must be implemented before the module is
 * considered fully covered by the AveryOS™ QA Engine.
 *
 * Run with: node --loader ../../loader.mjs --experimental-strip-types --test ${modName}.gen.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
${importLine}

${describes}
`;
}

// ── SHA-512 of entire generated output ───────────────────────────────────────

/**
 * Compute SHA-512 of all generated test content (ordered by module path).
 */
function computeGeneratedSha512(entries) {
  const allContent = entries
    .sort((a, b) => a.relPath.localeCompare(b.relPath))
    .map(e => `${e.relPath}::${e.sha512}`)
    .join("\n");
  return crypto.createHash("sha512").update(allContent).digest("hex");
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  log("AveryOS™ QA Test Generator v1.0 — scanning source files…");

  if (!DRY_RUN && !fs.existsSync(GEN_DIR)) {
    fs.mkdirSync(GEN_DIR, { recursive: true });
  }

  // Discover all source files
  const libFiles = findSourceFiles(LIB_DIR).map(f => ({ root: LIB_DIR, rel: f }));

  const coveredModules = findCoveredModules();
  log(`Found ${libFiles.length} source files. Covered modules: ${coveredModules.size}`);

  const report = {
    generated_at:   new Date().toISOString(),
    kernel_version: "v3.6.2",
    total_modules:  libFiles.length,
    covered:        [],
    uncovered:      [],
    skeletons:      [],
    suite_sha512:   "",
  };

  const generatedEntries = [];
  let generatedCount = 0;
  let skippedCount   = 0;

  for (const { root, rel } of libFiles) {
    const modBase   = path.basename(rel, ".ts").toLowerCase();
    const absPath   = path.join(root, rel);
    const isCovered = coveredModules.has(modBase);

    if (isCovered) {
      verbose(`✅ COVERED   ${rel}`);
      report.covered.push(rel);
      continue;
    }

    // Extract exports
    let exports = [];
    try {
      exports = extractExports(absPath);
    } catch (e) {
      warn(`Could not extract exports from ${rel}: ${e.message}`);
      continue;
    }

    if (exports.length === 0) {
      verbose(`⬜ SKIP      ${rel} (no exports)`);
      skippedCount++;
      continue;
    }

    warn(`⚠ UNCOVERED  ${rel} (${exports.filter(e => e.kind !== "type").length} testable exports)`);
    report.uncovered.push({ path: rel, exports: exports.map(e => `${e.kind}:${e.name}`) });

    // Generate skeleton
    const skeleton = generateTestSkeleton(rel, absPath, exports, root);
    const outName  = path.basename(rel, ".ts") + ".gen.test.ts";
    const outPath  = path.join(GEN_DIR, outName);
    const sha512   = crypto.createHash("sha512").update(skeleton).digest("hex");

    generatedEntries.push({ relPath: rel, sha512, outPath, outName });
    report.skeletons.push({ source: rel, output: outName, sha512: sha512.slice(0, 32) + "…" });

    if (DRY_RUN) {
      log(`[DRY-RUN] Would write: ${path.relative(ROOT, outPath)}`);
    } else if (FORCE || !fs.existsSync(outPath)) {
      fs.writeFileSync(outPath, skeleton, "utf8");
      ok(`Wrote: ${path.relative(ROOT, outPath)}`);
      generatedCount++;
    } else {
      verbose(`SKIP (exists): ${path.relative(ROOT, outPath)}`);
    }
  }

  // Compute suite SHA-512
  report.suite_sha512 = computeGeneratedSha512(generatedEntries);

  // Write coverage report
  if (!DRY_RUN) {
    const reportPath = path.join(GEN_DIR, "_coverage_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    ok(`Coverage report: ${path.relative(ROOT, reportPath)}`);
  }

  // Summary
  console.log("");
  log(`Summary:`);
  log(`  Total source modules:  ${libFiles.length}`);
  log(`  Already covered:       ${report.covered.length}`);
  log(`  Uncovered (skeletons): ${report.uncovered.length}`);
  log(`  Skipped (no exports):  ${skippedCount}`);
  log(`  Generated this run:    ${DRY_RUN ? "(dry-run)" : generatedCount}`);
  log(`  Suite SHA-512:         ${report.suite_sha512.slice(0, 32)}…`);

  if (report.uncovered.length > 0) {
    warn(`\n${report.uncovered.length} modules lack test coverage — implement the generated stubs.`);
    warn(`Run 'npm run qa:generate' to refresh after adding tests.`);
  } else {
    ok("\n✅ All lib/ modules have test coverage!");
  }

  if (!DRY_RUN && report.uncovered.length > 0) {
    process.exit(0); // Exit 0 — gaps are warnings, not hard failures until CI enforces them
  }
}

main();
