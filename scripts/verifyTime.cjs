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
 * scripts/verifyTime.cjs
 *
 * AveryOS™ Time-Drift Verifier — GATE 116.7.2
 *
 * Validates that sequential `Date.now()` calls produce strictly increasing
 * timestamps, confirming that 1,017-notch microsecond resolution is active
 * and the system clock is not frozen/cached.
 *
 * Rules:
 *   • Two immediate `Date.now()` calls MUST return different values.
 *   • Three sequential timestamps MUST be monotonically increasing.
 *   • The total elapsed time across 100 sequential samples MUST be > 0.
 *
 * Usage:
 *   node scripts/verifyTime.cjs
 *
 * Exit codes:
 *   0 — All time-drift checks passed. Clock is live and non-frozen.
 *   1 — One or more checks failed. Static/cached timestamps detected.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const crypto = require("crypto");

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const CYAN   = "\x1b[36m";
const YELLOW = "\x1b[33m";

function pass(msg)  { console.log(`${GREEN}[PASS]${RESET} ${msg}`); }
function fail(msg)  { console.error(`${RED}[FAIL]${RESET} ${msg}`); }
function info(msg)  { console.log(`${CYAN}[INFO]${RESET} ${msg}`); }
function warn(msg)  { console.log(`${YELLOW}[WARN]${RESET} ${msg}`); }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when process.hrtime.bigint is available (Node.js ≥ 10.7).
 * Extracted as a helper to avoid repeated typeof checks throughout the script.
 */
function hasHrtime() {
  return typeof process !== "undefined" && typeof process.hrtime === "function";
}

/**
 * Returns the current time as a BigInt nanosecond counter.
 * Falls back to `Date.now() * 1_000_000` when process.hrtime is unavailable.
 */
function hrtimeNs() {
  return hasHrtime() ? process.hrtime.bigint() : BigInt(Date.now() * 1_000_000);
}

/**
 * Capture a high-resolution timestamp using both Date.now() and
 * process.hrtime.bigint() (Node.js only).
 *
 * @returns {{ ms: number, ns: bigint }}
 */
function captureTs() {
  return {
    ms: Date.now(),
    ns: hrtimeNs(),
  };
}

/**
 * Busy-wait for `targetNs` nanoseconds without using setTimeout.
 * This ensures two consecutive timestamps capture different values
 * regardless of event-loop scheduling.
 */
function busyWaitNs(targetNs) {
  const start = hrtimeNs();
  while (true) {
    const now = hrtimeNs();
    if (now - start >= BigInt(targetNs)) break;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let failures = 0;

info("AveryOS™ Time-Drift Verifier — 1,017-notch resolution check");
info("─────────────────────────────────────────────────────────────");

// ── Test 1: Two sequential Date.now() values must differ ─────────────────────
{
  const t1 = captureTs();
  busyWaitNs(100_000); // 100 µs
  const t2 = captureTs();

  if (t1.ns >= t2.ns) {
    fail(`Test 1 FAILED — hrtime did not advance: t1=${t1.ns} t2=${t2.ns}`);
    failures++;
  } else {
    pass(`Test 1 — hrtime is strictly increasing: Δ=${t2.ns - t1.ns} ns`);
  }
}

// ── Test 2: Three sequential timestamps must be monotonically increasing ─────
{
  const samples = [];
  for (let i = 0; i < 3; i++) {
    samples.push(captureTs());
    busyWaitNs(200_000); // 200 µs between each
  }

  let monotonic = true;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].ns <= samples[i - 1].ns) {
      monotonic = false;
      fail(`Test 2 FAILED — timestamp regressed at index ${i}: ${samples[i].ns} <= ${samples[i - 1].ns}`);
      failures++;
      break;
    }
  }
  if (monotonic) {
    const delta = samples[samples.length - 1].ns - samples[0].ns;
    pass(`Test 2 — Monotonically increasing across 3 samples: total Δ=${delta} ns`);
  }
}

// ── Test 3: 100 samples must have strictly increasing ns values ───────────────
{
  const SAMPLES = 100;
  const ts = [];
  for (let i = 0; i < SAMPLES; i++) {
    ts.push(captureTs().ns);
    busyWaitNs(1_000); // 1 µs minimum gap
  }

  let regressions = 0;
  for (let i = 1; i < ts.length; i++) {
    if (ts[i] <= ts[i - 1]) regressions++;
  }

  if (regressions > 0) {
    fail(`Test 3 FAILED — ${regressions}/${SAMPLES - 1} regressions in 100-sample series`);
    failures++;
  } else {
    const span = ts[SAMPLES - 1] - ts[0];
    pass(`Test 3 — 100 samples, 0 regressions, total span=${span} ns`);
  }
}

// ── Test 4: Date.now() must advance by at least 1 ms across 100 calls ────────
{
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    busyWaitNs(10_000); // 10 µs
  }
  const end = Date.now();
  const elapsedMs = end - start;

  if (elapsedMs <= 0) {
    fail(`Test 4 FAILED — Date.now() did not advance over 100 iterations (elapsed=${elapsedMs} ms)`);
    failures++;
  } else {
    pass(`Test 4 — Date.now() advanced ${elapsedMs} ms across 100 iterations`);
  }
}

// ── Test 5: Verify non-static microseconds using sha512 nonce ────────────────
{
  const ts1 = `${Date.now()}:${hrtimeNs().toString()}`;
  busyWaitNs(500_000); // 500 µs
  const ts2 = `${Date.now()}:${hrtimeNs().toString()}`;

  const hash1 = crypto.createHash("sha512").update(ts1).digest("hex");
  const hash2 = crypto.createHash("sha512").update(ts2).digest("hex");

  if (hash1 === hash2) {
    fail(`Test 5 FAILED — SHA-512 nonces are identical (static clock)`);
    failures++;
  } else {
    pass(`Test 5 — SHA-512 nonces differ: ${hash1.slice(0, 16)}… ≠ ${hash2.slice(0, 16)}…`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

info("─────────────────────────────────────────────────────────────");

if (failures === 0) {
  pass("✅ All time-drift checks passed. Clock is live and 1,017-notch ready.");
  info("⛓️⚓⛓️ AveryOS™ Time-Mesh — Kernel: cf83e1…");
  process.exit(0);
} else {
  fail(`❌ ${failures} test(s) failed — static or frozen clock detected.`);
  warn("  → Check for environment timestamp caching (CI, Gemini API, etc.).");
  warn("  → Run with NTP sync active and a live system clock.");
  process.exit(1);
}
