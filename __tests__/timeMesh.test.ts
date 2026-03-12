/**
 * __tests__/timeMesh.test.ts
 *
 * Unit tests for lib/time/mesh.ts — getSovereignTime() and SovereignTimeResult.
 *
 * Verifies the shape and correctness of the returned SovereignTimeResult,
 * including the property names that were previously wrong in the route.
 *
 * Run with: node --experimental-strip-types --test __tests__/timeMesh.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getSovereignTime,
  type SovereignTimeResult,
  type TimeSourceResult,
  OUTLIER_DELTA_MS,
} from "../lib/time/mesh";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SovereignTimeResult shape", () => {
  test("getSovereignTime() returns all required SovereignTimeResult properties", async () => {
    const result: SovereignTimeResult = await getSovereignTime();

    // Verify canonical property names (these were wrong in the route — fixed in this PR)
    assert.ok("iso9"           in result, "iso9 property required");
    assert.ok("consensusMs"    in result, "consensusMs property required");
    assert.ok("sha512"         in result, "sha512 property required");
    assert.ok("sources"        in result, "sources property required");
    assert.ok("consensusCount" in result, "consensusCount property required");
    assert.ok("outlierCount"   in result, "outlierCount property required");
    assert.ok("kernelSha"      in result, "kernelSha property required");
    assert.ok("kernelVersion"  in result, "kernelVersion property required");

    // Confirm the properties that were WRONG in the original route do NOT exist
    // (these would be wrong: consensusIso9, consensusSourceCount, outliers)
    assert.ok(!("consensusIso9"         in result), "consensusIso9 must NOT exist on result");
    assert.ok(!("consensusSourceCount"  in result), "consensusSourceCount must NOT exist on result");
    assert.ok(!("outliers"              in result), "outliers array must NOT exist — use sources filtered by !included");
  });

  test("iso9 is a valid ISO-8601 string with 9 fractional digits", async () => {
    const result = await getSovereignTime();
    assert.match(result.iso9, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/);
  });

  test("consensusMs is a positive integer (Unix ms since epoch)", async () => {
    const result = await getSovereignTime();
    assert.equal(typeof result.consensusMs, "number");
    assert.ok(result.consensusMs > 1_700_000_000_000, "consensusMs should be a recent timestamp");
    assert.ok(Number.isInteger(result.consensusMs), "consensusMs should be an integer");
  });

  test("sha512 is a 128-character hex string", async () => {
    const result = await getSovereignTime();
    assert.equal(typeof result.sha512, "string");
    assert.equal(result.sha512.length, 128);
    assert.match(result.sha512, /^[0-9a-f]{128}$/);
  });

  test("kernelSha matches imported KERNEL_SHA constant", async () => {
    const result = await getSovereignTime();
    assert.equal(result.kernelSha, KERNEL_SHA);
  });

  test("kernelVersion matches imported KERNEL_VERSION constant", async () => {
    const result = await getSovereignTime();
    assert.equal(result.kernelVersion, KERNEL_VERSION);
  });

  test("sources is a non-empty array of TimeSourceResult", async () => {
    const result = await getSovereignTime();
    assert.ok(Array.isArray(result.sources), "sources must be an array");
    assert.ok(result.sources.length > 0, "sources must not be empty");

    for (const src of result.sources) {
      const s = src as TimeSourceResult;
      assert.equal(typeof s.name,    "string",  `source.name must be string`);
      assert.equal(typeof s.included, "boolean", `source.included must be boolean`);
      // epochMs is null on failure, number on success
      assert.ok(s.epochMs === null || typeof s.epochMs === "number");
      // deviationMs is null when epochMs is null
      assert.ok(s.deviationMs === null || typeof s.deviationMs === "number");
    }
  });

  test("consensusCount + outlierCount = total valid source count", async () => {
    const result = await getSovereignTime();
    const included  = result.sources.filter((s) => s.included).length;
    const notIncl   = result.sources.filter((s) => !s.included && s.epochMs !== null).length;
    assert.equal(result.consensusCount, included);
    assert.equal(result.outlierCount,   notIncl);
  });

  test("OUTLIER_DELTA_MS is 17 (aligns with 1,017-notch precision)", () => {
    assert.equal(OUTLIER_DELTA_MS, 17);
  });
});

describe("getSovereignTime() persistence callbacks", () => {
  test("dbFn callback receives a valid SovereignTimeResult", async () => {
    let captured: SovereignTimeResult | null = null;
    const dbFn = async (r: SovereignTimeResult) => { captured = r; };
    await getSovereignTime(dbFn);
    assert.ok(captured !== null, "dbFn should have been called");
    assert.ok("iso9" in (captured as SovereignTimeResult));
  });

  test("vaultFn callback receives a valid SovereignTimeResult", async () => {
    let captured: SovereignTimeResult | null = null;
    const vaultFn = async (r: SovereignTimeResult) => { captured = r; };
    await getSovereignTime(undefined, vaultFn);
    assert.ok(captured !== null, "vaultFn should have been called");
  });

  test("omitting both callbacks does not throw", async () => {
    const result = await getSovereignTime();
    assert.ok("iso9" in result);
  });
});
