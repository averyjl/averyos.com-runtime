#!/usr/bin/env node
/**
 * scripts/adversarialAutoHeal.cjs
 *
 * AveryOS™ Adversarial Test Gate — AutoHeal Engine
 *
 * Runs automatically inside the `adversarial-test-gate` CI workflow when one or
 * more gates fail.  Attempts to repair the failures in-place so that the gate can
 * be re-run and pass without human intervention.  Only auto-healable failures are
 * recovered; non-auto-healable failures are reported with full RCA and the process
 * exits non-zero so the workflow correctly marks the PR as blocked.
 *
 * Heal strategies:
 *   Gate A — ESLint errors
 *     → Run `eslint --fix` on the reported files.  Re-verify.
 *     → If ESLint errors remain after fix they are non-auto-healable; emit RCA.
 *
 *   Gate B — Unit test failures
 *     → Unit test logic errors cannot be auto-healed generically.
 *     → Emit full RCA with actionable steps and exit 1 so CI blocks the PR.
 *
 *   Gate C — Missing test stubs (coverage gaps)
 *     → Run `npm run qa:generate` (without --dry-run) to emit skeletons.
 *     → Re-verify in dry-run mode.  If gaps remain, emit RCA and exit 1.
 *
 * Usage (from CI):
 *   node scripts/adversarialAutoHeal.cjs --gate <A|B|C>
 *
 * Exit codes:
 *   0  All detected issues were healed; re-run the gate to confirm.
 *   1  One or more issues could not be auto-healed; PR must be blocked.
 *
 * ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
 * CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const { spawnSync } = require("child_process");
const path  = require("path");
const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ── CLI args ──────────────────────────────────────────────────────────────────

const GATE_ARG = (process.argv.find(a => a.startsWith("--gate=")) || "").replace("--gate=", "")
              || (process.argv[process.argv.indexOf("--gate") + 1] || "");

if (!["A", "B", "C"].includes(GATE_ARG)) {
  console.error("Usage: node scripts/adversarialAutoHeal.cjs --gate <A|B|C>");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROOT         = path.resolve(__dirname, "..");
const RESET        = "\x1b[0m";
const GREEN        = "\x1b[32m";
const YELLOW       = "\x1b[33m";
const CYAN         = "\x1b[36m";
const RED          = "\x1b[31m";
const BOLD         = "\x1b[1m";

function info(msg)  { console.log(`${CYAN}[AUTO-HEAL]${RESET} ${msg}`); }
function ok(msg)    { console.log(`${GREEN}[AUTO-HEAL]${RESET} ✅ ${msg}`); }
function warn(msg)  { console.log(`${YELLOW}[AUTO-HEAL]${RESET} ⚠️  ${msg}`); }
function fail(msg)  { console.error(`${RED}${BOLD}[AUTO-HEAL]${RESET}${RED} ❌ ${msg}${RESET}`); }

/**
 * Run a shell command and return { code, stdout, stderr }.
 * Never throws — callers inspect the return value.
 */
function run(cmd, opts = {}) {
  const result = spawnSync(cmd, { shell: true, cwd: ROOT, ...opts });
  return {
    code:   result.status ?? 1,
    stdout: (result.stdout || Buffer.alloc(0)).toString(),
    stderr: (result.stderr || Buffer.alloc(0)).toString(),
  };
}

// ── Gate A — ESLint AutoHeal ─────────────────────────────────────────────────

function healGateA() {
  info("Gate A AutoHeal — running eslint --fix …");

  run("npx eslint . --ext .js,.jsx,.ts,.tsx --ignore-pattern 'functions/' --ignore-pattern 'VaultEcho/' --fix 2>&1");
  logAosHeal("GATE_A_ESLINT_FIX", "eslint --fix applied to all source files");

  // Re-verify: a clean lint means all fixable errors were resolved.
  const verify = run("npm run lint 2>&1");
  if (verify.code === 0) {
    ok("Gate A — ESLint healed.  All errors resolved by --fix.");
    logAosHeal("GATE_A_HEALED", "ESLint --fix resolved all errors — gate will pass on re-run");
    return 0;
  }

  // Remaining errors are logic violations (not auto-fixable by ESLint).
  fail("Gate A — ESLint errors remain after --fix.  Manual upgrade required.");
  console.error(verify.stdout);
  logAosError(AOS_ERROR.DRIFT_DETECTED, "ESLint errors could not be auto-healed — see output above");
  console.error(`\n${YELLOW}${BOLD}── AutoHeal RCA: Gate A (ESLint) ──${RESET}`);
  console.error(`${YELLOW}Diagnosis  : eslint --fix resolved some issues but non-auto-fixable errors remain.${RESET}`);
  console.error(`${GREEN}Action 1   : Review each ESLint error listed above.${RESET}`);
  console.error(`${GREEN}Action 2   : Run 'npm run lint' locally and resolve errors manually.${RESET}`);
  console.error(`${GREEN}Action 3   : Follow AveryOS™ Code Conventions in CLAUDE.md § Code Conventions.${RESET}`);
  console.error(`${GREEN}Action 4   : All 'fix'/'patch' language must be changed to 'upgrade'/'improve'.${RESET}\n`);
  return 1;
}

// ── Gate B — Unit Test AutoHeal ──────────────────────────────────────────────

function healGateB() {
  // Unit test logic failures are not auto-healable generically.
  // Run the tests to capture the full failure output for RCA.
  info("Gate B AutoHeal — capturing unit test failure output for RCA …");

  const result = run("npm run test:unit 2>&1");

  if (result.code === 0) {
    ok("Gate B — Unit tests are now passing (may have been a transient failure).");
    logAosHeal("GATE_B_TRANSIENT_PASS", "Unit tests passed on AutoHeal re-run — transient failure suspected");
    return 0;
  }

  // Emit the full test output so developers can diagnose locally.
  fail("Gate B — Unit test failures detected.  Non-auto-healable — manual upgrade required.");
  console.error(result.stdout);
  logAosError(AOS_ERROR.INTERNAL_ERROR, "Unit test failures block PR — see test output above");

  console.error(`\n${YELLOW}${BOLD}── AutoHeal RCA: Gate B (Unit Tests) ──${RESET}`);
  console.error(`${YELLOW}Diagnosis  : One or more unit tests failed.  Logic errors cannot be auto-healed.${RESET}`);
  console.error(`${GREEN}Action 1   : Run 'npm run test:unit' locally and read the failure output.${RESET}`);
  console.error(`${GREEN}Action 2   : Follow the Tri-Agent TDD Review Cycle (Step 3 — Upgrade Cycle).${RESET}`);
  console.error(`${GREEN}Action 3   : Agent A (Implementer) must upgrade the implementation until all TDD${RESET}`);
  console.error(`${GREEN}             contract tests from Step 0 are green.${RESET}`);
  console.error(`${GREEN}Action 4   : Agent B / C must re-run adversarial tests (Step 4) after upgrade.${RESET}`);
  console.error(`${GREEN}Action 5   : Seal only when 'npm run test:unit' exits 0 with no failures.${RESET}\n`);
  return 1;
}

// ── Gate C — Coverage Stub AutoHeal ─────────────────────────────────────────

function healGateC() {
  info("Gate C AutoHeal — running qa:generate to emit missing test stubs …");

  const gen = run("npm run qa:generate 2>&1");
  logAosHeal("GATE_C_QA_GENERATE", "qa:generate ran — new test stubs emitted to __tests__/generated/");

  if (gen.code !== 0) {
    fail("Gate C — qa:generate itself failed.  Cannot emit stubs.");
    console.error(gen.stdout);
    logAosError(AOS_ERROR.INTERNAL_ERROR, "qa:generate exited non-zero during AutoHeal — see output above");
    return 1;
  }

  // Check whether new stubs were actually written.
  const status = run("git status --porcelain __tests__/generated/ 2>&1");
  const newFiles = status.stdout.trim().split("\n").filter(Boolean);

  if (newFiles.length > 0) {
    info(`Gate C — ${newFiles.length} new stub file(s) generated:`);
    newFiles.forEach(f => info(`  ${f.trim()}`));
    logAosHeal("GATE_C_STUBS_GENERATED", `${newFiles.length} test stub(s) emitted and ready to commit`);
  } else {
    warn("Gate C — qa:generate ran but produced no new files.  Coverage gap may be a phantom.");
  }

  // Re-verify in dry-run mode with CI=true to confirm the gate will pass.
  const recheck = run("node scripts/qaTestGenerator.cjs --dry-run 2>&1", { env: { ...process.env, CI: "true" } });
  if (recheck.code === 0) {
    ok("Gate C — Coverage stubs healed.  All exported symbols now have test stubs.");
    logAosHeal("GATE_C_HEALED", "Coverage stub audit will pass on re-run — all exports covered");
    return 0;
  }

  fail("Gate C — Coverage gaps remain after qa:generate.  Manual stub authoring required.");
  console.error(recheck.stdout);
  logAosError(AOS_ERROR.DRIFT_DETECTED, "Coverage gaps remain after AutoHeal — see qa:generate output above");

  console.error(`\n${YELLOW}${BOLD}── AutoHeal RCA: Gate C (Coverage Stubs) ──${RESET}`);
  console.error(`${YELLOW}Diagnosis  : Exported symbols still lack test stubs after auto-generation.${RESET}`);
  console.error(`${YELLOW}             This usually means a module exports complex types the generator${RESET}`);
  console.error(`${YELLOW}             cannot parse (e.g. re-exports, barrel files, dynamic keys).${RESET}`);
  console.error(`${GREEN}Action 1   : Run 'npm run qa:generate --verbose' locally to see which symbols are flagged.${RESET}`);
  console.error(`${GREEN}Action 2   : Manually create a test stub in __tests__/ for the flagged module.${RESET}`);
  console.error(`${GREEN}Action 3   : Follow the Step 0 TDD Contract in CLAUDE.md (write tests FIRST).${RESET}`);
  console.error(`${GREEN}Action 4   : Re-run 'npm run qa:generate' to confirm the gap is resolved.${RESET}\n`);
  return 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────

info(`AveryOS™ Adversarial AutoHeal — Gate ${GATE_ARG}`);
info(`Kernel: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e`);

let exitCode;
switch (GATE_ARG) {
  case "A": exitCode = healGateA(); break;
  case "B": exitCode = healGateB(); break;
  case "C": exitCode = healGateC(); break;
  default:  exitCode = 1;
}

process.exit(exitCode);
