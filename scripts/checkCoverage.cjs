#!/usr/bin/env node
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
const COVERAGE_THRESHOLD = 100.00;

// ── Coverage line patterns (Node.js built-in test runner output) ──────────────
//
// Example Node.js coverage summary lines (TAP-like):
//   # lines: 82.35% (56/68)
//   # branches: 75.00% (12/16)
//   # functions: 88.24% (15/17)
//
const METRIC_RE = /^#\s+(lines|branches|functions)\s*:\s*([\d.]+)%/i;

/**
 * Parse coverage metrics from raw test runner output text.
 * Returns an array of { metric, percent } objects.
 *
 * @param {string} text - raw stdout from node --experimental-test-coverage
 * @returns {{ metric: string, percent: number }[]}
 */
function parseCoverageMetrics(text) {
  const metrics = [];
  for (const line of text.split(/\r?\n/)) {
    const m = METRIC_RE.exec(line.trim());
    if (m) {
      metrics.push({ metric: m[1].toLowerCase(), percent: parseFloat(m[2]) });
    }
  }
  return metrics;
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
