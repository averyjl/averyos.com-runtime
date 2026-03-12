/**
 * __tests__/sovereignError.test.ts
 *
 * Unit tests for lib/sovereignError.ts
 *
 * Covers:
 *   - AOS_ERROR catalogue completeness
 *   - buildAosError() — RCA payload shape
 *   - aosErrorResponse() — correct HTTP status codes per error code
 *   - d1ErrorResponse() — table-not-found detection
 *   - classifyAndRespond() — error classification heuristics
 *   - buildAosUiError() — client-side serialisable payload
 *
 * Perspective: human_developer (API consumer) + human_user (UI error messages)
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/sovereignError.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AOS_ERROR,
  buildAosError,
  aosErrorResponse,
  d1ErrorResponse,
  classifyAndRespond,
  buildAosUiError,
  type AosApiError,
  type AosErrorCode,
} from "../lib/sovereignError";

// ── AOS_ERROR catalogue ───────────────────────────────────────────────────────

describe("AOS_ERROR catalogue", () => {
  test("contains all required auth error codes", () => {
    assert.equal(AOS_ERROR.MISSING_AUTH,         "MISSING_AUTH");
    assert.equal(AOS_ERROR.INVALID_AUTH,         "INVALID_AUTH");
    assert.equal(AOS_ERROR.UNAUTHORIZED,         "UNAUTHORIZED");
    assert.equal(AOS_ERROR.VAULT_NOT_CONFIGURED, "VAULT_NOT_CONFIGURED");
    assert.equal(AOS_ERROR.FORBIDDEN,            "FORBIDDEN");
  });

  test("contains all required DB error codes", () => {
    assert.equal(AOS_ERROR.DB_UNAVAILABLE,  "DB_UNAVAILABLE");
    assert.equal(AOS_ERROR.DB_QUERY_FAILED, "DB_QUERY_FAILED");
    assert.equal(AOS_ERROR.KV_UNAVAILABLE,  "KV_UNAVAILABLE");
    assert.equal(AOS_ERROR.KV_WRITE_FAILED, "KV_WRITE_FAILED");
    assert.equal(AOS_ERROR.BINDING_MISSING, "BINDING_MISSING");
  });

  test("contains sovereign-specific error codes", () => {
    assert.equal(AOS_ERROR.DRIFT_DETECTED, "DRIFT_DETECTED");
    assert.equal(AOS_ERROR.LICENSE_INVALID, "LICENSE_INVALID");
  });

  test("all values are non-empty strings", () => {
    for (const [key, val] of Object.entries(AOS_ERROR)) {
      assert.ok(typeof val === "string" && val.length > 0, `AOS_ERROR.${key} should be a non-empty string`);
    }
  });

  test("all values equal their own keys (identity pattern)", () => {
    for (const [key, val] of Object.entries(AOS_ERROR)) {
      assert.equal(val, key, `AOS_ERROR.${key} should equal "${key}"`);
    }
  });
});

// ── buildAosError ─────────────────────────────────────────────────────────────

describe("buildAosError()", () => {
  test("produces a correctly-shaped AosApiError", () => {
    const err: AosApiError = buildAosError(AOS_ERROR.MISSING_AUTH, "No header");
    assert.equal(err.error,           AOS_ERROR.MISSING_AUTH);
    assert.equal(err.detail,          "No header");
    assert.equal(err.sovereign_anchor, "⛓️⚓⛓️");
    assert.ok(typeof err.diagnosis === "string" && err.diagnosis.length > 0);
    assert.ok(Array.isArray(err.steps) && err.steps.length > 0);
    assert.ok(typeof err.timestamp === "string");
  });

  test("timestamp is a valid ISO date string", () => {
    const err = buildAosError(AOS_ERROR.INTERNAL_ERROR, "test");
    assert.ok(!isNaN(Date.parse(err.timestamp)), `timestamp "${err.timestamp}" should be parseable`);
  });

  test("unknown code still returns a valid shape", () => {
    // Cast to force unknown code path
    const err = buildAosError("SOME_UNKNOWN_CODE" as AosErrorCode, "test detail");
    assert.ok(typeof err.diagnosis === "string");
    assert.ok(Array.isArray(err.steps));
    assert.equal(err.sovereign_anchor, "⛓️⚓⛓️");
  });

  test("overrides can replace diagnosis and steps", () => {
    const err = buildAosError(AOS_ERROR.MISSING_AUTH, "test", {
      diagnosis: "Custom diagnosis",
      steps: ["Step A", "Step B"],
    });
    assert.equal(err.diagnosis, "Custom diagnosis");
    assert.deepEqual(err.steps, ["Step A", "Step B"]);
  });
});

// ── aosErrorResponse HTTP status codes ───────────────────────────────────────

describe("aosErrorResponse() — HTTP status codes", () => {
  const STATUS_EXPECTATIONS: [AosErrorCode, number][] = [
    [AOS_ERROR.MISSING_AUTH,    401],
    [AOS_ERROR.INVALID_AUTH,    401],
    [AOS_ERROR.NOT_FOUND,       404],
    [AOS_ERROR.INVALID_JSON,    400],
    [AOS_ERROR.MISSING_FIELD,   400],
    [AOS_ERROR.DB_UNAVAILABLE,  503],
    [AOS_ERROR.DB_QUERY_FAILED, 500],
    [AOS_ERROR.INTERNAL_ERROR,  500],
    // UNAUTHORIZED and FORBIDDEN are not in the RCA_REGISTRY so they default to 500
    [AOS_ERROR.UNAUTHORIZED,    500],
    [AOS_ERROR.FORBIDDEN,       500],
  ];

  for (const [code, expectedStatus] of STATUS_EXPECTATIONS) {
    test(`${code} → HTTP ${expectedStatus}`, () => {
      const res = aosErrorResponse(code, "test detail");
      assert.equal(res.status, expectedStatus);
    });
  }

  test("statusOverride parameter overrides RCA-derived status", () => {
    const res = aosErrorResponse(AOS_ERROR.MISSING_AUTH, "test", 418);
    assert.equal(res.status, 418);
  });

  test("response body is JSON-parseable AosApiError", async () => {
    const res  = aosErrorResponse(AOS_ERROR.MISSING_AUTH, "No auth header");
    const body = await res.json() as AosApiError;
    assert.equal(body.error,           AOS_ERROR.MISSING_AUTH);
    assert.equal(body.sovereign_anchor, "⛓️⚓⛓️");
    assert.ok(typeof body.diagnosis === "string");
  });

  test("Content-Type is application/json", () => {
    const res = aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, "test");
    assert.ok(res.headers.get("content-type")?.includes("application/json"));
  });
});

// ── d1ErrorResponse ───────────────────────────────────────────────────────────

describe("d1ErrorResponse()", () => {
  test("'no such table' message → DB_QUERY_FAILED with migration hint", async () => {
    const res  = d1ErrorResponse("D1_ERROR: no such table: sovereign_audit_logs");
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DB_QUERY_FAILED);
    assert.ok(body.detail.includes("wrangler d1 migrations"), `detail: ${body.detail}`);
  });

  test("table name match in message includes table hint", async () => {
    const res  = d1ErrorResponse("table qa_audit_log not found", "qa_audit_log");
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DB_QUERY_FAILED);
    assert.ok(body.detail.includes("qa_audit_log"));
  });

  test("generic D1 error (no table name) → DB_QUERY_FAILED", async () => {
    const res  = d1ErrorResponse("Some generic D1 failure");
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DB_QUERY_FAILED);
  });

  test("returns a Response with status 500", () => {
    const res = d1ErrorResponse("generic error");
    assert.equal(res.status, 500);
  });
});

// ── classifyAndRespond ────────────────────────────────────────────────────────

describe("classifyAndRespond()", () => {
  test("classifies 'unauthorized' message → INVALID_AUTH (unauthenticated/unauthorized pattern)", async () => {
    const res  = classifyAndRespond(new Error("unauthorized access attempt"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.INVALID_AUTH);
  });

  test("classifies 'no such table' message → DB_QUERY_FAILED", async () => {
    const res  = classifyAndRespond(new Error("no such table: foo"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DB_QUERY_FAILED);
  });

  test("classifies 'd1' in message → DB_QUERY_FAILED", async () => {
    const res  = classifyAndRespond(new Error("D1 query failed"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DB_QUERY_FAILED);
  });

  test("unrecognised message → INTERNAL_ERROR", async () => {
    const res  = classifyAndRespond(new Error("network timeout"));
    const body = await res.json() as AosApiError;
    // classifyAndRespond does not special-case 'network'; falls back to INTERNAL_ERROR
    assert.equal(body.error, AOS_ERROR.INTERNAL_ERROR);
  });

  test("non-Error values are converted to string and classified", async () => {
    const res  = classifyAndRespond("something unexpected");
    const body = await res.json() as AosApiError;
    // Should not throw; produces a valid AosApiError
    assert.ok(typeof body.error === "string");
    assert.equal(body.sovereign_anchor, "⛓️⚓⛓️");
  });
});

// ── buildAosUiError ───────────────────────────────────────────────────────────

describe("buildAosUiError()", () => {
  test("produces a serialisable UI error object", () => {
    const err = buildAosUiError(AOS_ERROR.NOT_FOUND, "Page not found");
    assert.equal(err.code,   AOS_ERROR.NOT_FOUND);
    assert.equal(err.detail, "Page not found");
    assert.ok(typeof err.diagnosis === "string" && err.diagnosis.length > 0);
    assert.ok(Array.isArray(err.steps));
  });

  test("object is JSON-serialisable (no circular references)", () => {
    const err  = buildAosUiError(AOS_ERROR.INTERNAL_ERROR, "crash");
    const json = JSON.stringify(err);
    assert.ok(typeof json === "string" && json.length > 0);
  });
});
