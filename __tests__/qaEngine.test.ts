/**
 * __tests__/qaEngine.test.ts
 *
 * Unit tests for lib/qa/engine.ts, lib/qa/security.ts, lib/qa/performance.ts
 *
 * Validates the core QA Engine data model, SHA-512 signing, suite builder,
 * security payload utilities, and performance benchmark helpers.
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/qaEngine.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// QA Engine
import {
  assessRunStatus,
  computeQaSha512,
  buildQaRunRecord,
  buildQaSuite,
  runTest,
  type QaTestResult,
  type QaSuiteResult,
  type QaRunRecord,
} from "../lib/qa/engine";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// Security utilities
import {
  XSS_PAYLOADS,
  SQL_INJECTION_PAYLOADS,
  BOT_USER_AGENTS,
  BROWSER_USER_AGENTS,
  ABUSE_HEADERS,
  assessSecurityHeaders,
  isSanitizedSafe,
  RECOMMENDED_SECURITY_HEADERS,
} from "../lib/qa/security";

// Performance utilities
import {
  runBenchmark,
  assertBenchmarkAvg,
  assertBenchmarkP95,
  PERF_THRESHOLDS,
  type BenchmarkResult,
} from "../lib/qa/performance";

// ── assessRunStatus ───────────────────────────────────────────────────────────

describe("assessRunStatus()", () => {
  test("all passing → 'pass'", () => {
    assert.equal(assessRunStatus(10, 0), "pass");
  });

  test("all failing → 'fail'", () => {
    assert.equal(assessRunStatus(0, 5), "fail");
  });

  test("some passing, some failing → 'partial'", () => {
    assert.equal(assessRunStatus(8, 2), "partial");
  });

  test("0 passed and 0 failed → 'pass' (empty run is a pass)", () => {
    assert.equal(assessRunStatus(0, 0), "pass");
  });
});

// ── computeQaSha512 ───────────────────────────────────────────────────────────

describe("computeQaSha512()", () => {
  async function makePartial(): Promise<Omit<QaRunRecord, "sha512">> {
    return {
      runId:         "test-run-001",
      trigger:       "unit-test",
      status:        "pass",
      totalTests:    5,
      passedTests:   5,
      failedTests:   0,
      kernelSha:     KERNEL_SHA,
      kernelVersion: KERNEL_VERSION,
      suites:        [],
      createdAt:     "2026-03-12T01:06:58.938000000Z",
    };
  }

  test("returns a 128-character hex string (SHA-512)", async () => {
    const partial = await makePartial();
    const sha     = await computeQaSha512(partial);
    assert.equal(sha.length, 128, `Expected 128 chars, got ${sha.length}`);
    assert.match(sha, /^[0-9a-f]{128}$/, "Should be lowercase hex");
  });

  test("same input produces same hash (deterministic)", async () => {
    const partial = await makePartial();
    const sha1    = await computeQaSha512(partial);
    const sha2    = await computeQaSha512(partial);
    assert.equal(sha1, sha2);
  });

  test("changing any field changes the hash", async () => {
    const p1 = await makePartial();
    const p2 = { ...p1, passedTests: 4, failedTests: 1, status: "partial" as const };
    const s1 = await computeQaSha512(p1);
    const s2 = await computeQaSha512(p2);
    assert.notEqual(s1, s2, "Different records must produce different hashes");
  });
});

// ── buildQaSuite ──────────────────────────────────────────────────────────────

describe("buildQaSuite()", () => {
  function makeTest(passed: boolean, durationMs = 1): QaTestResult {
    return {
      name:         passed ? "passing test" : "failing test",
      passed,
      durationMs,
      perspective:  "human_developer",
      severity:     "low",
      errorMessage: passed ? null : "assertion failed",
    };
  }

  test("counts passed and failed correctly", () => {
    const suite = buildQaSuite("test-suite", [
      makeTest(true),
      makeTest(true),
      makeTest(false),
    ]);
    assert.equal(suite.passed, 2);
    assert.equal(suite.failed, 1);
    assert.equal(suite.total,  3);
  });

  test("sums durationMs across tests", () => {
    const suite = buildQaSuite("timing-suite", [
      makeTest(true, 10),
      makeTest(true, 20),
      makeTest(false, 5),
    ]);
    assert.equal(suite.durationMs, 35);
  });

  test("empty tests array produces zero counts", () => {
    const suite = buildQaSuite("empty", []);
    assert.equal(suite.total,  0);
    assert.equal(suite.passed, 0);
    assert.equal(suite.failed, 0);
  });
});

// ── runTest ───────────────────────────────────────────────────────────────────

describe("runTest()", () => {
  test("passing fn → passed=true, errorMessage=null", async () => {
    const result = await runTest("ok test", "human_developer", "low", () => { /* passes */ });
    assert.equal(result.passed,       true);
    assert.equal(result.errorMessage, null);
  });

  test("throwing fn → passed=false, errorMessage contains message", async () => {
    const result = await runTest("fail test", "security_probe", "high", () => {
      throw new Error("intentional failure");
    });
    assert.equal(result.passed, false);
    assert.ok(result.errorMessage?.includes("intentional failure"));
  });

  test("async fn is awaited correctly", async () => {
    const result = await runTest("async ok", "human_user", "low", async () => {
      await Promise.resolve();
    });
    assert.equal(result.passed, true);
  });

  test("result carries name, perspective, severity", async () => {
    const result = await runTest("named test", "bot_crawler", "critical", () => {});
    assert.equal(result.name,        "named test");
    assert.equal(result.perspective, "bot_crawler");
    assert.equal(result.severity,    "critical");
  });

  test("durationMs is a non-negative number", async () => {
    const result = await runTest("timing test", "performance", "info", () => {});
    assert.ok(result.durationMs >= 0, `durationMs should be >=0, got ${result.durationMs}`);
  });
});

// ── buildQaRunRecord ──────────────────────────────────────────────────────────

describe("buildQaRunRecord()", () => {
  async function makeRecord(): Promise<QaRunRecord> {
    const suite = buildQaSuite("test-suite", [
      { name: "t1", passed: true,  durationMs: 1, perspective: "human_user", severity: "low",  errorMessage: null },
      { name: "t2", passed: false, durationMs: 2, perspective: "bot_crawler", severity: "high", errorMessage: "fail" },
    ]);
    return buildQaRunRecord([suite], "unit-test", "fixed-run-id");
  }

  test("record carries correct counts", async () => {
    const r = await makeRecord();
    assert.equal(r.totalTests,  2);
    assert.equal(r.passedTests, 1);
    assert.equal(r.failedTests, 1);
  });

  test("status is 'partial' when some pass and some fail", async () => {
    const r = await makeRecord();
    assert.equal(r.status, "partial");
  });

  test("record has kernelSha and kernelVersion from sovereignConstants", async () => {
    const r = await makeRecord();
    assert.equal(r.kernelSha,    KERNEL_SHA);
    assert.equal(r.kernelVersion, KERNEL_VERSION);
  });

  test("sha512 is a 128-char hex string", async () => {
    const r = await makeRecord();
    assert.equal(r.sha512.length, 128);
    assert.match(r.sha512, /^[0-9a-f]{128}$/);
  });

  test("runId is set correctly when provided", async () => {
    const r = await makeRecord();
    assert.equal(r.runId, "fixed-run-id");
  });

  test("runId auto-generated when omitted", async () => {
    const r = await buildQaRunRecord([], "ci");
    assert.ok(typeof r.runId === "string" && r.runId.length > 0);
  });

  test("createdAt is a 30-char ISO-9 string", async () => {
    const r = await makeRecord();
    assert.equal(r.createdAt.length, 30, `createdAt: ${r.createdAt}`);
    assert.ok(r.createdAt.endsWith("Z"));
  });

  test("all-pass suite → status='pass'", async () => {
    const suite = buildQaSuite("all-pass", [
      { name: "t", passed: true, durationMs: 1, perspective: "human_user", severity: "low", errorMessage: null },
    ]);
    const r = await buildQaRunRecord([suite], "ci");
    assert.equal(r.status, "pass");
  });
});

// ── Security utilities ────────────────────────────────────────────────────────

describe("XSS_PAYLOADS", () => {
  test("is a non-empty array of strings", () => {
    assert.ok(Array.isArray(XSS_PAYLOADS) && XSS_PAYLOADS.length > 0);
    for (const p of XSS_PAYLOADS) {
      assert.ok(typeof p === "string" && p.length > 0, `Payload should be non-empty string: ${p}`);
    }
  });

  test("each payload contains at least one dangerous pattern", () => {
    // A broader set matching all attack vectors in the list
    // (some payloads use JS context without HTML tags, e.g. the JS string injection payload)
    const dangerous = /<script|javascript:|onerror=|onload=|onfocus=|onclick=|ontoggle=|onstart=|<iframe|<object|<embed|<svg|alert\(|<marquee|<body|<details|<input/i;
    for (const p of XSS_PAYLOADS) {
      assert.ok(dangerous.test(p), `Expected payload to contain dangerous pattern: ${p}`);
    }
  });
});

describe("SQL_INJECTION_PAYLOADS", () => {
  test("is a non-empty array of strings", () => {
    assert.ok(Array.isArray(SQL_INJECTION_PAYLOADS) && SQL_INJECTION_PAYLOADS.length > 0);
  });

  test("each payload contains SQL keywords or special chars", () => {
    const sqlKeywords = /SELECT|DROP|UNION|INSERT|OR 1=1|SLEEP|'|"/i;
    for (const p of SQL_INJECTION_PAYLOADS) {
      assert.ok(sqlKeywords.test(p), `Expected SQL keyword/char in: ${p}`);
    }
  });
});

describe("assessSecurityHeaders()", () => {
  test("returns pass=true when all recommended headers are present", () => {
    const headers = new Headers();
    for (const name of Object.keys(RECOMMENDED_SECURITY_HEADERS)) {
      headers.set(name, "present");
    }
    const report = assessSecurityHeaders(headers);
    assert.equal(report.pass,        true);
    assert.equal(report.missing.length, 0);
    assert.ok(report.present.length > 0);
  });

  test("returns pass=false when headers are missing", () => {
    const report = assessSecurityHeaders(new Headers());
    assert.equal(report.pass, false);
    assert.ok(report.missing.length > 0);
  });

  test("correctly identifies partially-present headers", () => {
    const headers = new Headers({ "x-content-type-options": "nosniff" });
    const report  = assessSecurityHeaders(headers);
    assert.ok(report.present.includes("x-content-type-options"));
    assert.ok(report.missing.includes("strict-transport-security"));
  });
});

describe("isSanitizedSafe()", () => {
  test("returns true for plain text", () => {
    assert.equal(isSanitizedSafe("Hello, World!"), true);
  });

  test("returns false for <script> tag", () => {
    assert.equal(isSanitizedSafe("<script>alert(1)</script>"), false);
  });

  test("returns false for javascript: protocol", () => {
    assert.equal(isSanitizedSafe('<a href="javascript:void(0)">'), false);
  });

  test("returns false for onerror= attribute", () => {
    assert.equal(isSanitizedSafe("<img src=x onerror=alert(1)>"), false);
  });

  test("returns true for safe HTML subset", () => {
    assert.equal(isSanitizedSafe("<p>Hello <strong>world</strong></p>"), true);
  });
});

// ── Performance utilities ─────────────────────────────────────────────────────

describe("runBenchmark()", () => {
  test("returns a BenchmarkResult with correct name and iterations", async () => {
    const result: BenchmarkResult = await runBenchmark("noop", () => {}, 10);
    assert.equal(result.name,       "noop");
    assert.equal(result.iterations, 10);
  });

  test("totalMs >= sum would not exceed reasonable wall-clock", async () => {
    const result = await runBenchmark("noop", () => {}, 5);
    assert.ok(result.totalMs >= 0);
    assert.ok(result.avgMs >= 0);
  });

  test("minMs <= avgMs <= maxMs", async () => {
    const result = await runBenchmark("range-check", () => {}, 20);
    assert.ok(result.minMs <= result.avgMs, `minMs=${result.minMs} > avgMs=${result.avgMs}`);
    assert.ok(result.avgMs <= result.maxMs + 1, `avgMs=${result.avgMs} > maxMs=${result.maxMs}`);
  });

  test("throws RangeError for iterations=0", async () => {
    await assert.rejects(
      () => runBenchmark("zero", () => {}, 0),
      RangeError,
    );
  });

  test("works with async fn", async () => {
    const result = await runBenchmark("async-noop", async () => { await Promise.resolve(); }, 5);
    assert.equal(result.iterations, 5);
  });
});

describe("assertBenchmarkAvg()", () => {
  test("does not throw when avgMs is below limit", () => {
    const result: BenchmarkResult = {
      name: "fast", iterations: 10, totalMs: 10,
      avgMs: 1, minMs: 0, maxMs: 2, medianMs: 1, p95Ms: 2, p99Ms: 2,
    };
    assert.doesNotThrow(() => assertBenchmarkAvg(result, PERF_THRESHOLDS.UTILITY_AVG_MS));
  });

  test("throws when avgMs exceeds limit", () => {
    const result: BenchmarkResult = {
      name: "slow", iterations: 10, totalMs: 1000,
      avgMs: 500, minMs: 100, maxMs: 900, medianMs: 500, p95Ms: 800, p99Ms: 900,
    };
    assert.throws(() => assertBenchmarkAvg(result, 10), {
      message: /Performance regression/,
    });
  });
});

describe("PERF_THRESHOLDS", () => {
  test("all threshold values are positive numbers", () => {
    for (const [key, val] of Object.entries(PERF_THRESHOLDS)) {
      assert.ok(typeof val === "number" && val > 0, `PERF_THRESHOLDS.${key} should be > 0`);
    }
  });
});

// ── Bot / Browser classification ──────────────────────────────────────────────

describe("BOT_USER_AGENTS and BROWSER_USER_AGENTS arrays", () => {
  test("BOT_USER_AGENTS is non-empty and all strings", () => {
    assert.ok(Array.isArray(BOT_USER_AGENTS) && BOT_USER_AGENTS.length > 0);
    for (const ua of BOT_USER_AGENTS) {
      assert.ok(typeof ua === "string" && ua.length > 0);
    }
  });

  test("BROWSER_USER_AGENTS is non-empty and all strings", () => {
    assert.ok(Array.isArray(BROWSER_USER_AGENTS) && BROWSER_USER_AGENTS.length > 0);
  });

  test("BOT_USER_AGENTS match the AI_BOT_PATTERNS regex from middleware", () => {
    const AI_BOT_PATTERNS = /bot|crawl|spider|slurp|scraper|curl|wget|python-requests|\bjava\/|go-http|okhttp|axios|node-fetch|headless|phantom|selenium|puppeteer|playwright|openai|gpt|claude|anthropic|bard|gemini|llama|meta-llm|cohere|perplexity/i;
    for (const ua of BOT_USER_AGENTS) {
      assert.ok(AI_BOT_PATTERNS.test(ua), `Expected BOT pattern match for: ${ua}`);
    }
  });

  test("ABUSE_HEADERS is a non-empty array of record objects", () => {
    assert.ok(Array.isArray(ABUSE_HEADERS) && ABUSE_HEADERS.length > 0);
    for (const hdr of ABUSE_HEADERS) {
      assert.ok(typeof hdr === "object" && hdr !== null);
    }
  });
});
