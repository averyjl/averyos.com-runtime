/**
 * __tests__/wafLogic.test.ts
 *
 * Unit tests for lib/security/wafLogic.ts
 *
 * Covers:
 *   - parseWafScore() — header parsing
 *   - evaluateWafScore() — action derivation for all threshold combinations
 *   - buildWafBlockResponse() — 403 response shape
 *   - buildWafChallengeRedirect() — 302 redirect shape
 *   - applyWafGate() — end-to-end gate convenience function
 *
 * Perspective: security_probe (adversarial) + human_user (legitimate)
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/wafLogic.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseWafScore,
  evaluateWafScore,
  buildWafBlockResponse,
  buildWafChallengeRedirect,
  applyWafGate,
  WAF_BLOCK_THRESHOLD,
  WAF_CHALLENGE_THRESHOLD,
  WAF_EVIDENCE_THRESHOLD,
  WAF_SENSITIVE_PATHS,
  AUDIT_CLEARANCE_PATH,
} from "../lib/security/wafLogic";

// ── parseWafScore ─────────────────────────────────────────────────────────────

describe("parseWafScore()", () => {
  test("returns null when no WAF headers are present", () => {
    const h = new Headers();
    assert.equal(parseWafScore(h), null);
  });

  test("parses cf-waf-attack-score header", () => {
    const h = new Headers({ "cf-waf-attack-score": "75" });
    assert.equal(parseWafScore(h), 75);
  });

  test("parses x-waf-score fallback header", () => {
    const h = new Headers({ "x-waf-score": "42" });
    assert.equal(parseWafScore(h), 42);
  });

  test("prefers cf-waf-attack-score over x-waf-score", () => {
    const h = new Headers({ "cf-waf-attack-score": "90", "x-waf-score": "10" });
    assert.equal(parseWafScore(h), 90);
  });

  test("returns null for non-numeric header value", () => {
    const h = new Headers({ "x-waf-score": "high" });
    assert.equal(parseWafScore(h), null);
  });

  test("returns null for empty string header value", () => {
    const h = new Headers({ "x-waf-score": "" });
    assert.equal(parseWafScore(h), null);
  });

  test("handles score of 0 correctly", () => {
    const h = new Headers({ "x-waf-score": "0" });
    assert.equal(parseWafScore(h), 0);
  });

  test("handles score of 100 correctly", () => {
    const h = new Headers({ "x-waf-score": "100" });
    assert.equal(parseWafScore(h), 100);
  });
});

// ── evaluateWafScore ──────────────────────────────────────────────────────────

describe("evaluateWafScore()", () => {
  test("null score → allow on any path", () => {
    const r = evaluateWafScore("/api/v1/health", null);
    assert.equal(r.action, "allow");
    assert.equal(r.score, 0);
  });

  test("score=0 → allow on normal path", () => {
    const r = evaluateWafScore("/about", 0);
    assert.equal(r.action, "allow");
  });

  test(`score > ${WAF_BLOCK_THRESHOLD} → block regardless of path`, () => {
    const r = evaluateWafScore("/", WAF_BLOCK_THRESHOLD + 1);
    assert.equal(r.action, "block");
    assert.equal(r.score,  WAF_BLOCK_THRESHOLD + 1);
    assert.ok(r.reason?.includes("hard block"));
  });

  test(`score exactly = ${WAF_BLOCK_THRESHOLD} → allow (not > threshold)`, () => {
    const r = evaluateWafScore("/", WAF_BLOCK_THRESHOLD);
    assert.notEqual(r.action, "block");
  });

  test(`score > ${WAF_CHALLENGE_THRESHOLD} on normal path → challenge`, () => {
    const r = evaluateWafScore("/about", WAF_CHALLENGE_THRESHOLD + 1);
    assert.equal(r.action, "challenge");
    assert.equal(r.redirectTo, AUDIT_CLEARANCE_PATH);
  });

  test(`score = ${WAF_CHALLENGE_THRESHOLD} on normal path → allow`, () => {
    const r = evaluateWafScore("/about", WAF_CHALLENGE_THRESHOLD);
    assert.equal(r.action, "allow");
  });

  test("sensitive path: score > evidence threshold → challenge", () => {
    for (const p of WAF_SENSITIVE_PATHS) {
      const r = evaluateWafScore(p + "/sub", WAF_EVIDENCE_THRESHOLD + 1);
      assert.equal(r.action, "challenge", `Expected challenge on ${p}`);
    }
  });

  test("sensitive path: score = evidence threshold → allow", () => {
    const r = evaluateWafScore("/evidence-vault/bundle", WAF_EVIDENCE_THRESHOLD);
    assert.equal(r.action, "allow");
  });

  test("sensitive path above challenge threshold still blocks if > 95", () => {
    const r = evaluateWafScore("/api/v1/vault", 100);
    assert.equal(r.action, "block");
  });
});

// ── buildWafBlockResponse ─────────────────────────────────────────────────────

describe("buildWafBlockResponse()", () => {
  test("returns 403 status", async () => {
    const res = buildWafBlockResponse(99);
    assert.equal(res.status, 403);
  });

  test("response body is valid JSON with error key", async () => {
    const res  = buildWafBlockResponse(99);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, "SOVEREIGN_WAF_BLOCK");
    assert.equal(typeof body.waf_score, "number");
    assert.ok(typeof body.kernel_sha === "string");
  });

  test("response Content-Type is application/json", () => {
    const res = buildWafBlockResponse(99);
    assert.ok(res.headers.get("content-type")?.includes("application/json"));
  });
});

// ── buildWafChallengeRedirect ─────────────────────────────────────────────────

describe("buildWafChallengeRedirect()", () => {
  test("returns 302 status", () => {
    const res = buildWafChallengeRedirect(85, "https://averyos.com");
    assert.equal(res.status, 302);
  });

  test("Location header contains audit clearance path", () => {
    const res = buildWafChallengeRedirect(85, "https://averyos.com");
    const loc = res.headers.get("location") ?? "";
    assert.ok(loc.includes(AUDIT_CLEARANCE_PATH), `Location: ${loc}`);
  });

  test("Location header contains waf_score param", () => {
    const res = buildWafChallengeRedirect(85, "https://averyos.com");
    const loc = res.headers.get("location") ?? "";
    assert.ok(loc.includes("waf_score=85"), `Location: ${loc}`);
  });
});

// ── applyWafGate ──────────────────────────────────────────────────────────────

describe("applyWafGate()", () => {
  function makeRequest(url: string, headers: Record<string, string> = {}): Request {
    return new Request(url, { headers });
  }

  test("returns null (allow) for a clean request", () => {
    const req = makeRequest("https://averyos.com/about");
    assert.equal(applyWafGate(req, "https://averyos.com"), null);
  });

  test("returns 403 Response for score > 95", () => {
    const req = makeRequest("https://averyos.com/about", { "x-waf-score": "96" });
    const res = applyWafGate(req, "https://averyos.com");
    assert.ok(res instanceof Response);
    assert.equal(res?.status, 403);
  });

  test("returns 302 Response for score > 80 on normal path", () => {
    const req = makeRequest("https://averyos.com/about", { "x-waf-score": "81" });
    const res = applyWafGate(req, "https://averyos.com");
    assert.ok(res instanceof Response);
    assert.equal(res?.status, 302);
  });

  test("returns 302 Response for score > 60 on sensitive path", () => {
    const req = makeRequest("https://averyos.com/evidence-vault/b", { "x-waf-score": "61" });
    const res = applyWafGate(req, "https://averyos.com");
    assert.ok(res instanceof Response);
    assert.equal(res?.status, 302);
  });

  test("returns null for score exactly at challenge threshold on normal path", () => {
    const req = makeRequest("https://averyos.com/about", { "x-waf-score": "80" });
    assert.equal(applyWafGate(req, "https://averyos.com"), null);
  });
});

// ── Threshold constant checks ─────────────────────────────────────────────────

describe("WAF threshold constants", () => {
  test("WAF_BLOCK_THRESHOLD is 95", () => {
    assert.equal(WAF_BLOCK_THRESHOLD, 95);
  });

  test("WAF_CHALLENGE_THRESHOLD is 80", () => {
    assert.equal(WAF_CHALLENGE_THRESHOLD, 80);
  });

  test("WAF_EVIDENCE_THRESHOLD is 60", () => {
    assert.equal(WAF_EVIDENCE_THRESHOLD, 60);
  });

  test("WAF_BLOCK > WAF_CHALLENGE > WAF_EVIDENCE", () => {
    assert.ok(WAF_BLOCK_THRESHOLD > WAF_CHALLENGE_THRESHOLD);
    assert.ok(WAF_CHALLENGE_THRESHOLD > WAF_EVIDENCE_THRESHOLD);
  });

  test("WAF_SENSITIVE_PATHS is a non-empty array", () => {
    assert.ok(Array.isArray(WAF_SENSITIVE_PATHS));
    assert.ok(WAF_SENSITIVE_PATHS.length > 0);
  });
});
