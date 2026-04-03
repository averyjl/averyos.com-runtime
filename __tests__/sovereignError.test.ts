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
  classifyApiResponseError,
  withAosErrorHandling,
  logAosScriptError,
  logAosHeal,
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

// ── classifyAndRespond — additional branches ──────────────────────────────────

describe("classifyAndRespond() — additional error branches", () => {
  test("classifies 'stripe' in message → STRIPE_ERROR", async () => {
    const res  = classifyAndRespond(new Error("stripe charge failed"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.STRIPE_ERROR);
  });

  test("classifies 'binding' in message → BINDING_MISSING", async () => {
    const res  = classifyAndRespond(new Error("binding not found"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.BINDING_MISSING);
  });

  test("classifies 'env.db' in message → BINDING_MISSING", async () => {
    const res  = classifyAndRespond(new Error("env.db is undefined"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.BINDING_MISSING);
  });

  test("classifies 'json' in message → INVALID_JSON", async () => {
    const res  = classifyAndRespond(new Error("json parse error"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.INVALID_JSON);
  });

  test("classifies 'parse' in message → INVALID_JSON", async () => {
    const res  = classifyAndRespond(new Error("failed to parse body"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.INVALID_JSON);
  });

  test("classifies 'expired' in message → TOKEN_EXPIRED", async () => {
    const res  = classifyAndRespond(new Error("token expired"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.TOKEN_EXPIRED);
  });

  test("classifies 'not found' in message → NOT_FOUND", async () => {
    const res  = classifyAndRespond(new Error("resource not found"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.NOT_FOUND);
  });

  test("classifies '404' in message → NOT_FOUND", async () => {
    const res  = classifyAndRespond(new Error("HTTP 404 response"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.NOT_FOUND);
  });

  test("classifies 'drift' in message → DRIFT_DETECTED", async () => {
    const res  = classifyAndRespond(new Error("drift detected in kernel"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DRIFT_DETECTED);
  });

  test("classifies 'kv' in message → KV_UNAVAILABLE", async () => {
    const res  = classifyAndRespond(new Error("kv namespace unavailable"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.KV_UNAVAILABLE);
  });

  test("classifies 'sqlite' in message → DB_QUERY_FAILED", async () => {
    const res  = classifyAndRespond(new Error("sqlite constraint violation"));
    const body = await res.json() as AosApiError;
    assert.equal(body.error, AOS_ERROR.DB_QUERY_FAILED);
  });
});

// ── withAosErrorHandling ──────────────────────────────────────────────────────

describe("withAosErrorHandling()", () => {
  test("passes through successful handler response", async () => {
    const handler = async (_req: Request) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 });
    const wrapped = withAosErrorHandling(handler);
    const res = await wrapped(new Request("https://averyos.com/test"));
    assert.equal(res.status, 200);
    const body = await res.json() as { ok: boolean };
    assert.equal(body.ok, true);
  });

  test("catches thrown errors and returns an AOS error response", async () => {
    const handler = async (_req: Request): Promise<Response> => {
      throw new Error("stripe payment declined");
    };
    const wrapped = withAosErrorHandling(handler);
    const res = await wrapped(new Request("https://averyos.com/test"));
    // Should be a non-200 error response, not an unhandled rejection
    assert.ok(res.status >= 400);
    const body = await res.json() as AosApiError;
    assert.ok(typeof body.error === "string");
    assert.equal(body.sovereign_anchor, "⛓️⚓⛓️");
  });

  test("wraps handler that throws a non-Error value", async () => {
    const handler = async (_req: Request): Promise<Response> => {
      throw "plain string error"; // eslint-disable-line no-throw-literal
    };
    const wrapped = withAosErrorHandling(handler);
    const res = await wrapped(new Request("https://averyos.com/test"));
    assert.ok(res.status >= 400);
  });

  test("forwards ctx argument to the handler", async () => {
    let receivedCtx: unknown;
    const handler = async (_req: Request, ctx: unknown) => {
      receivedCtx = ctx;
      return new Response("ok");
    };
    const wrapped = withAosErrorHandling(handler);
    await wrapped(new Request("https://averyos.com/"), { waitUntil: () => {} });
    assert.ok(receivedCtx !== undefined);
  });
});

// ── logAosScriptError ─────────────────────────────────────────────────────────

describe("logAosScriptError()", () => {
  test("does not throw for a known error code with string detail", () => {
    assert.doesNotThrow(() =>
      logAosScriptError(AOS_ERROR.DB_UNAVAILABLE, "test detail")
    );
  });

  test("does not throw for an unknown error code", () => {
    assert.doesNotThrow(() =>
      logAosScriptError("CUSTOM_CODE" as AosErrorCode, "custom detail")
    );
  });

  test("does not throw when cause is an Error with a stack", () => {
    const cause = new Error("root cause");
    assert.doesNotThrow(() =>
      logAosScriptError(AOS_ERROR.INTERNAL_ERROR, "detail", cause)
    );
  });

  test("does not throw when cause is a non-Error value", () => {
    assert.doesNotThrow(() =>
      logAosScriptError(AOS_ERROR.INTERNAL_ERROR, "detail", "string cause")
    );
  });
});

// ── logAosHeal ────────────────────────────────────────────────────────────────

describe("logAosHeal()", () => {
  test("does not throw for a known error code", () => {
    assert.doesNotThrow(() =>
      logAosHeal(AOS_ERROR.DB_UNAVAILABLE, "retrying connection")
    );
  });

  test("does not throw for an unknown code string", () => {
    assert.doesNotThrow(() =>
      logAosHeal("CUSTOM" as AosErrorCode, "auto-heal action")
    );
  });
});

// ── classifyApiResponseError ──────────────────────────────────────────────────

describe("classifyApiResponseError()", () => {
  test("extracts code and detail from API body", () => {
    const body = { error: AOS_ERROR.NOT_FOUND, detail: "capsule missing" };
    const uiErr = classifyApiResponseError(body);
    assert.equal(uiErr.code, AOS_ERROR.NOT_FOUND);
    assert.equal(uiErr.detail, "capsule missing");
    assert.ok(typeof uiErr.diagnosis === "string" && uiErr.diagnosis.length > 0);
    assert.ok(Array.isArray(uiErr.steps));
  });

  test("falls back to INTERNAL_ERROR when error field is absent", () => {
    const body = { message: "something went wrong" };
    const uiErr = classifyApiResponseError(body);
    assert.equal(uiErr.code, AOS_ERROR.INTERNAL_ERROR);
  });

  test("uses error string as detail when detail field is absent", () => {
    const body = { error: AOS_ERROR.DRIFT_DETECTED };
    const uiErr = classifyApiResponseError(body);
    assert.equal(uiErr.detail, AOS_ERROR.DRIFT_DETECTED);
  });

  test("produces a JSON-serialisable object", () => {
    const uiErr = classifyApiResponseError({ error: AOS_ERROR.KV_UNAVAILABLE, detail: "kv gone" });
    assert.doesNotThrow(() => JSON.stringify(uiErr));
  });
});
