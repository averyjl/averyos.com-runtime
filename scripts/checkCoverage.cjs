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
 * scripts/checkCoverage.cjs
 *
 * AveryOS™ Sovereign Coverage Gate — GATE 128.2.2
 *
 * Parses the stdout produced by `node --experimental-test-coverage` and
 * asserts that every coverage metric (line, branch, function) meets the
 * mandatory 100.00% threshold.  Exits with code 1 (blocking push) if
 * any metric falls below the required level.
 *
 * Usage (piped from test runner):
 *   node --experimental-test-coverage --test ... | node scripts/checkCoverage.cjs
 *
 * Or standalone (reads from stdin or a file argument):
 *   node scripts/checkCoverage.cjs [coverage-output.txt]
 *
 * Exit codes:
 *   0 — all metrics at or above COVERAGE_THRESHOLD (100.00%)
 *   1 — one or more metrics below COVERAGE_THRESHOLD, or parse error
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Sovereign mandate ─────────────────────────────────────────────────────────
// Default sovereign threshold is 100.00% (absolute ceiling — no drift tolerated).
// For coverage:gate CI checks targeting lib/ + app/api/ code, set the threshold
// to 80.00% via the --threshold=<n> CLI flag as defined in the QA audit spec.
//
// Usage:
//   node scripts/checkCoverage.cjs                    # defaults to 100.00%
//   node scripts/checkCoverage.cjs --threshold=80     # ≥80% gate (QA audit)
const thresholdArg = process.argv.find(a => a.startsWith("--threshold="));
const COVERAGE_THRESHOLD = thresholdArg
  ? Math.max(0, Math.min(100, parseFloat(thresholdArg.split("=")[1])))
  : 100.00;

// ── Coverage line patterns (Node.js built-in test runner output) ──────────────
//
// Node.js --experimental-test-coverage emits a columnar summary table:
//
//   ℹ start of coverage report
//   ℹ -----------------------------------------------------------------------
//   ℹ file            | line % | branch % | funcs % | uncovered lines
//   ℹ -----------------------------------------------------------------------
//   ℹ  foo.ts         | 100.00 |   100.00 |  100.00 |
//   ℹ -----------------------------------------------------------------------
//   ℹ all files       |  82.04 |    68.18 |   50.00 |
//   ℹ -----------------------------------------------------------------------
//   ℹ end of coverage report
//
// The "all files" row contains the rolled-up totals we enforce.
//
const ALL_FILES_RE = /^[iℹ]\s+all\s+files\s+\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/i;

/**
 * Parse the rolled-up coverage percentages from the "all files" row in the
 * Node.js --experimental-test-coverage table output.
 *
 * @param {string} text - raw stdout/stderr from node --experimental-test-coverage
 * @returns {{ metric: string, percent: number }[]}
 */
function parseCoverageMetrics(text) {
  for (const line of text.split(/\r?\n/)) {
    const m = ALL_FILES_RE.exec(line.trim());
    if (m) {
      return [
        { metric: "lines",     percent: parseFloat(m[1]) },
        { metric: "branches",  percent: parseFloat(m[2]) },
        { metric: "functions", percent: parseFloat(m[3]) },
      ];
    }
  }
  return [];
}

/**
 * Read all stdin into a string (for piped usage).
 * @returns {Promise<string>}
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  let text = "";

  const filePath = process.argv[2];
  if (filePath) {
    // File argument provided
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      console.error(`❌ Coverage file not found: ${abs}`);
      process.exit(1);
    }
    text = fs.readFileSync(abs, "utf8");
  } else if (process.stdin.isTTY !== true) {
    // Piped from test runner
    text = await readStdin();
  } else {
    console.error(
      "⚠️  checkCoverage: no input — pipe coverage output or pass a file path.\n" +
      "   Example: npm run test:coverage 2>&1 | node scripts/checkCoverage.cjs"
    );
    process.exit(1);
  }

  // Echo the raw text so the developer sees the full report
  process.stdout.write(text);

  const metrics = parseCoverageMetrics(text);

  if (metrics.length === 0) {
    console.error(
      "\n❌  checkCoverage: no coverage metrics found in output.\n" +
      "   Ensure the test suite is run with --experimental-test-coverage."
    );
    process.exit(1);
  }

  console.log(`\n⛓️  AveryOS™ Sovereign Coverage Gate (GATE 128.2.2) — threshold: ${COVERAGE_THRESHOLD.toFixed(2)}%`);

  let failed = false;
  for (const { metric, percent } of metrics) {
    const pass = percent >= COVERAGE_THRESHOLD;
    const icon = pass ? "✅" : "❌";
    const label = metric.padEnd(10);
    console.log(`   ${icon}  ${label}: ${percent.toFixed(2)}%${pass ? "" : `  ← BELOW ${COVERAGE_THRESHOLD.toFixed(2)}% mandate`}`);
    if (!pass) failed = true;
  }

  if (failed) {
    console.error(
      "\n❌  Coverage gate FAILED — push blocked.\n" +
      "   All modules must reach 100.00% line/branch/function coverage.\n" +
      "   Write or upgrade tests until all metrics reach 100.00%.\n" +
      "   AveryOS Constitution v1.17 Art. 2, 14, 19 — drift not tolerated."
    );
    process.exit(1);
  }

  console.log("\n✅  Coverage gate PASSED — all metrics at 100.00%. Push cleared.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌  checkCoverage: unexpected error:", err);
  process.exit(1);
});
