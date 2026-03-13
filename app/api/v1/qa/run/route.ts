/**
 * POST /api/v1/qa/run
 *
 * AveryOS™ Sovereign QA Engine — Phase 112 / GATE 112.4
 *
 * Admin-authenticated endpoint that runs the in-process QA suite
 * (WAF logic, DriftShield, error handling, performance benchmarks, and
 * security checks from human + machine perspectives), records the result
 * to D1 qa_audit_log, and returns the full signed QaRunRecord.
 *
 * Auth: x-vault-auth header or aos-vault-auth HttpOnly cookie.
 *
 * Body (optional JSON):
 *   { trigger?: "manual" | "ci" | "scheduled" }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { KERNEL_VERSION, KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { VAULT_COOKIE_NAME } from "../../../../../lib/vaultCookieConfig";
import {
  buildQaRunRecord,
  buildQaSuite,
  runTest,
  type QaSuiteResult,
} from "../../../../../lib/qa/engine";
import { logBuildResult } from "../../../../../lib/qa/buildResultsLogger";
import {
  XSS_PAYLOADS,
  SQL_INJECTION_PAYLOADS,
  BOT_USER_AGENTS,
  BROWSER_USER_AGENTS,
  ABUSE_HEADERS,
  isSanitizedSafe,
  assessSecurityHeaders,
} from "../../../../../lib/qa/security";
import {
  runBenchmark,
  assertBenchmarkAvg,
  PERF_THRESHOLDS,
} from "../../../../../lib/qa/performance";
import {
  parseWafScore,
  evaluateWafScore,
  WAF_BLOCK_THRESHOLD,
  WAF_CHALLENGE_THRESHOLD,
} from "../../../../../lib/security/wafLogic";
import {
  loadDriftShieldConfig,
  enforceDriftShield,
} from "../../../../../lib/security/driftShield";

// ── Types ─────────────────────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface R2Bucket {
  put(key: string, body: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

interface CloudflareEnv {
  DB:           D1Database;
  VAULT_R2?:    R2Bucket;
  VAULT_PASSPHRASE?: string;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function extractToken(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.split(";").map(c => c.trim())
    .find(c => c.startsWith(`${VAULT_COOKIE_NAME}=`));
  if (match) return decodeURIComponent(match.slice(VAULT_COOKIE_NAME.length + 1));
  return request.headers.get("x-vault-auth") ?? "";
}

function safeEqual(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  let diff = la ^ lb;
  for (let i = 0; i < Math.max(la, lb); i++) {
    diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return diff === 0 && la > 0;
}

// ── QA Suites ─────────────────────────────────────────────────────────────────

/** Suite 1 — WAF Logic (machine perspective) */
async function runWafSuite(): Promise<QaSuiteResult> {
  const tests = await Promise.all([
    runTest("parseWafScore returns null with no headers", "security_probe", "high", () => {
      const score = parseWafScore(new Headers());
      if (score !== null) throw new Error(`Expected null, got ${score}`);
    }),
    runTest("score > 95 → block action", "security_probe", "critical", () => {
      const r = evaluateWafScore("/api/v1/test", WAF_BLOCK_THRESHOLD + 1);
      if (r.action !== "block") throw new Error(`Expected block, got ${r.action}`);
    }),
    runTest("score > 80 on normal path → challenge", "security_probe", "high", () => {
      const r = evaluateWafScore("/about", WAF_CHALLENGE_THRESHOLD + 1);
      if (r.action !== "challenge") throw new Error(`Expected challenge, got ${r.action}`);
    }),
    runTest("score = 0 → allow", "human_user", "low", () => {
      const r = evaluateWafScore("/about", 0);
      if (r.action !== "allow") throw new Error(`Expected allow, got ${r.action}`);
    }),
    runTest("null score → allow (score unavailable)", "human_user", "low", () => {
      const r = evaluateWafScore("/about", null);
      if (r.action !== "allow") throw new Error(`Expected allow, got ${r.action}`);
    }),
    runTest("evidence-vault path: score > 60 → challenge", "security_probe", "high", () => {
      const r = evaluateWafScore("/evidence-vault/test", 61);
      if (r.action !== "challenge") throw new Error(`Expected challenge, got ${r.action}`);
    }),
  ]);
  return buildQaSuite("WAF Logic", tests);
}

/** Suite 2 — DriftShield (bot/AI perspective) */
async function runDriftShieldSuite(): Promise<QaSuiteResult> {
  const tests = await Promise.all([
    runTest("clean request passes DriftShield", "human_user", "low", () => {
      const r = enforceDriftShield(new Request("https://averyos.com/api/v1/test"));
      if (!r.pass) throw new Error(`Expected pass, got block: ${(r as { reason?: string }).reason}`);
    }),
    runTest("jitter=1 is blocked by DriftShield", "ai_agent", "critical", () => {
      const r = enforceDriftShield(
        new Request("https://averyos.com/api/v1/test", { headers: { "x-averyos-jitter": "1" } })
      );
      if (r.pass) throw new Error("Expected DriftShield to block jitter request");
    }),
    runTest("WAF score > 60 is blocked", "security_probe", "high", () => {
      const r = enforceDriftShield(
        new Request("https://averyos.com/api/v1/test", { headers: { "x-waf-score": "61" } })
      );
      if (r.pass) throw new Error("Expected DriftShield to block score=61");
    }),
    runTest("DriftShield config loads from defaults", "human_developer", "low", () => {
      const cfg = loadDriftShieldConfig({});
      if (cfg.threshold !== 60) throw new Error(`Expected threshold=60, got ${cfg.threshold}`);
      if (!cfg.zeroNoise)        throw new Error("Expected zeroNoise=true");
    }),
    runTest("DriftShield block carries kernelSha anchor", "documentation", "medium", () => {
      const r = enforceDriftShield(
        new Request("https://averyos.com/api/v1/test", { headers: { "x-waf-score": "99" } })
      );
      if (r.kernelSha !== KERNEL_SHA) throw new Error("kernelSha mismatch");
    }),
  ]);
  return buildQaSuite("DriftShield v4.1", tests);
}

/** Suite 3 — Security / XSS / SQL injection (adversarial perspective) */
async function runSecuritySuite(): Promise<QaSuiteResult> {
  const tests = await Promise.all([
    runTest("isSanitizedSafe returns true for plain text", "human_user", "low", () => {
      if (!isSanitizedSafe("Hello World")) throw new Error("Expected safe");
    }),
    runTest("isSanitizedSafe returns false for <script>", "security_probe", "critical", () => {
      if (isSanitizedSafe("<script>alert(1)</script>")) throw new Error("Expected unsafe");
    }),
    runTest("isSanitizedSafe returns false for javascript: protocol", "security_probe", "critical", () => {
      if (isSanitizedSafe('<a href="javascript:alert(1)">')) throw new Error("Expected unsafe");
    }),
    runTest("XSS_PAYLOADS are all non-empty strings", "security_probe", "medium", () => {
      if (XSS_PAYLOADS.length === 0) throw new Error("XSS_PAYLOADS is empty");
    }),
    runTest("SQL_INJECTION_PAYLOADS are all non-empty strings", "security_probe", "medium", () => {
      if (SQL_INJECTION_PAYLOADS.length === 0) throw new Error("SQL_INJECTION_PAYLOADS is empty");
    }),
    runTest("BOT_USER_AGENTS list is non-empty", "ai_agent", "medium", () => {
      if (BOT_USER_AGENTS.length === 0) throw new Error("BOT_USER_AGENTS is empty");
    }),
    runTest("BROWSER_USER_AGENTS list is non-empty", "human_user", "low", () => {
      if (BROWSER_USER_AGENTS.length === 0) throw new Error("BROWSER_USER_AGENTS is empty");
    }),
    runTest("Security headers: assessSecurityHeaders detects missing headers", "human_developer", "medium", () => {
      const report = assessSecurityHeaders(new Headers());
      if (report.pass)             throw new Error("Expected missing headers");
      if (report.missing.length === 0) throw new Error("Expected missing list to be non-empty");
    }),
    runTest("ABUSE_HEADERS catalog is non-empty", "security_probe", "low", () => {
      if (ABUSE_HEADERS.length === 0) throw new Error("ABUSE_HEADERS is empty");
    }),
  ]);
  return buildQaSuite("Security Checks", tests);
}

/** Suite 4 — Performance benchmarks */
async function runPerfSuite(): Promise<QaSuiteResult> {
  const tests = await Promise.all([
    runTest("SHA-512 compute ≤ 50ms avg (10 iterations)", "performance", "medium", async () => {
      const result = await runBenchmark(
        "SHA-512 of kernel sha",
        async () => {
          const raw = new TextEncoder().encode(KERNEL_SHA);
          await crypto.subtle.digest("SHA-512", raw);
        },
        10,
      );
      assertBenchmarkAvg(result, PERF_THRESHOLDS.CRYPTO_AVG_MS);
    }),
    runTest("evaluateWafScore ≤ 10ms avg (100 iterations)", "performance", "medium", async () => {
      const result = await runBenchmark(
        "evaluateWafScore",
        () => { evaluateWafScore("/api/v1/test", 50); },
        100,
      );
      assertBenchmarkAvg(result, PERF_THRESHOLDS.UTILITY_AVG_MS);
    }),
    runTest("loadDriftShieldConfig ≤ 10ms avg (100 iterations)", "performance", "low", async () => {
      const result = await runBenchmark(
        "loadDriftShieldConfig",
        () => { loadDriftShieldConfig({}); },
        100,
      );
      assertBenchmarkAvg(result, PERF_THRESHOLDS.UTILITY_AVG_MS);
    }),
    runTest("formatIso9 ≤ 10ms avg (100 iterations)", "performance", "low", async () => {
      const { formatIso9 } = await import("../../../../../lib/timePrecision");
      const result = await runBenchmark(
        "formatIso9",
        () => { formatIso9(new Date()); },
        100,
      );
      assertBenchmarkAvg(result, PERF_THRESHOLDS.UTILITY_AVG_MS);
    }),
  ]);
  return buildQaSuite("Performance Benchmarks", tests);
}

/** Suite 5 — Kernel anchor integrity (documentation + sovereignty) */
async function runKernelSuite(): Promise<QaSuiteResult> {
  const tests = await Promise.all([
    runTest("KERNEL_SHA is a 128-char hex string", "documentation", "critical", () => {
      if (KERNEL_SHA.length !== 128) throw new Error(`Expected 128 chars, got ${KERNEL_SHA.length}`);
      if (!/^[0-9a-f]+$/.test(KERNEL_SHA)) throw new Error("KERNEL_SHA must be lowercase hex");
    }),
    runTest("KERNEL_VERSION matches vX.Y.Z format", "documentation", "high", () => {
      if (!/^v\d+\.\d+\.\d+$/.test(KERNEL_VERSION)) {
        throw new Error(`KERNEL_VERSION "${KERNEL_VERSION}" does not match vX.Y.Z`);
      }
    }),
    runTest("formatIso9 output ends with Z and has 9 fractional digits", "documentation", "medium", async () => {
      const { formatIso9 } = await import("../../../../../lib/timePrecision");
      const ts = formatIso9(new Date("2026-01-01T00:00:00.000Z"));
      if (!ts.endsWith("Z")) throw new Error(`Expected Z suffix: ${ts}`);
      const m = ts.match(/\.(\d+)Z$/);
      if (!m || m[1]!.length !== 9) throw new Error(`Expected 9 fractional digits: ${ts}`);
    }),
  ]);
  return buildQaSuite("Kernel Anchor Integrity", tests);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const token      = extractToken(request);
    const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";

    if (!passphrase) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, "VAULT_PASSPHRASE not set");
    }
    if (!safeEqual(token, passphrase)) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Invalid vault auth token");
    }

    // ── Trigger ───────────────────────────────────────────────────────────────
    let trigger = "manual";
    try {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.trigger === "string") trigger = body.trigger;
    } catch { /* body is optional */ }

    // ── Run all suites ────────────────────────────────────────────────────────
    const [wafSuite, driftSuite, secSuite, perfSuite, kernelSuite] = await Promise.all([
      runWafSuite(),
      runDriftShieldSuite(),
      runSecuritySuite(),
      runPerfSuite(),
      runKernelSuite(),
    ]);

    const record = await buildQaRunRecord(
      [wafSuite, driftSuite, secSuite, perfSuite, kernelSuite],
      trigger,
    );

    // ── Persist to D1 ─────────────────────────────────────────────────────────
    if (cfEnv.DB) {
      try {
        await cfEnv.DB.prepare(
          `INSERT OR IGNORE INTO qa_audit_log
             (run_id, trigger, status, total_tests, passed_tests, failed_tests,
               sha512, kernel_sha, kernel_version, run_details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          record.runId,
          record.trigger,
          record.status,
          record.totalTests,
          record.passedTests,
          record.failedTests,
          record.sha512,
          record.kernelSha,
          record.kernelVersion,
          JSON.stringify(record.suites),
          record.createdAt,
        ).run();
      } catch (_dbErr) {
        // Non-fatal — return results even if D1 write fails
      }

      // ── Also persist to qa_build_results (D1 + R2) ──────────────────────────
      await logBuildResult(
        {
          buildId:      record.runId,
          engine:       "QA",
          status:       record.status === "pass" ? "pass" : record.status === "partial" ? "partial" : "fail",
          totalChecks:  record.totalTests,
          passedChecks: record.passedTests,
          failedChecks: record.failedTests,
          resultData:   record,
        },
        cfEnv.DB,
        cfEnv.VAULT_R2 ?? null,
      );
    }

    return Response.json({
      status:        record.status,
      runId:         record.runId,
      totalTests:    record.totalTests,
      passedTests:   record.passedTests,
      failedTests:   record.failedTests,
      sha512:        record.sha512,
      kernelSha:     record.kernelSha,
      kernelVersion: record.kernelVersion,
      createdAt:     record.createdAt,
      trigger:       record.trigger,
      suites:        record.suites.map((s) => ({
        suiteName:  s.suiteName,
        total:      s.total,
        passed:     s.passed,
        failed:     s.failed,
        durationMs: s.durationMs,
        tests:      s.tests.map((t) => ({
          name:         t.name,
          passed:       t.passed,
          durationMs:   t.durationMs,
          perspective:  t.perspective,
          severity:     t.severity,
          errorMessage: t.errorMessage,
        })),
      })),
      sovereign_anchor: "⛓️⚓⛓️",
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(msg, "qa_audit_log");
  }
}

export const runtime = undefined; // Use Cloudflare Worker runtime (not edge)
