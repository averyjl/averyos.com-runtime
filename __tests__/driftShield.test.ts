/**
 * __tests__/driftShield.test.ts
 *
 * Unit tests for lib/security/driftShield.ts
 *
 * Covers:
 *   - loadDriftShieldConfig() — env → config parsing with defaults
 *   - enforceDriftShield() — all pass/block branches
 *
 * Perspective: security_probe (adversarial) + ai_agent (bot injection)
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/driftShield.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadDriftShieldConfig,
  enforceDriftShield,
  type DriftShieldConfig,
} from "../lib/security/driftShield";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Helper ────────────────────────────────────────────────────────────────────

// Each call receives a unique RFC 5737 TEST-NET IP so tests don't share the
// module-level Economic Throttle token bucket (GATE 114.6.3).
let _testIpSeq = 0;
function makeRequest(headers: Record<string, string> = {}): Request {
  const ip = `192.0.2.${(_testIpSeq++ % 253) + 1}`;
  return new Request("https://averyos.com/api/v1/test", {
    headers: { "cf-connecting-ip": ip, ...headers },
  });
}

// ── loadDriftShieldConfig ─────────────────────────────────────────────────────

describe("loadDriftShieldConfig()", () => {
  test("returns secure defaults when no env is provided", () => {
    const cfg: DriftShieldConfig = loadDriftShieldConfig();
    assert.equal(cfg.threshold,  60);
    assert.equal(cfg.entropyMin, 0);
    assert.equal(cfg.zeroNoise,  true);
  });

  test("returns secure defaults when env is empty object", () => {
    const cfg = loadDriftShieldConfig({});
    assert.equal(cfg.threshold,  60);
    assert.equal(cfg.zeroNoise,  true);
  });

  test("parses DRIFT_SHIELD_THRESHOLD from env string", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THRESHOLD: "75" });
    assert.equal(cfg.threshold, 75);
  });

  test("clamps DRIFT_SHIELD_THRESHOLD to [0, 100]", () => {
    assert.equal(loadDriftShieldConfig({ DRIFT_SHIELD_THRESHOLD: "-5"  }).threshold, 0);
    assert.equal(loadDriftShieldConfig({ DRIFT_SHIELD_THRESHOLD: "150" }).threshold, 100);
  });

  test("falls back to default threshold for non-numeric env value", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THRESHOLD: "high" });
    assert.equal(cfg.threshold, 60);
  });

  test("parses DRIFT_SHIELD_ENTROPY_MIN from env string", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_ENTROPY_MIN: "3.5" });
    assert.ok(cfg.entropyMin === 3.5);
  });

  test("zeroNoise is false only when DRIFT_SHIELD_ZERO_NOISE='0'", () => {
    assert.equal(loadDriftShieldConfig({ DRIFT_SHIELD_ZERO_NOISE: "0"   }).zeroNoise, false);
    assert.equal(loadDriftShieldConfig({ DRIFT_SHIELD_ZERO_NOISE: "1"   }).zeroNoise, true);
    assert.equal(loadDriftShieldConfig({ DRIFT_SHIELD_ZERO_NOISE: "off" }).zeroNoise, true);
    assert.equal(loadDriftShieldConfig({}).zeroNoise, true);
  });
});

// ── enforceDriftShield — pass cases ──────────────────────────────────────────

describe("enforceDriftShield() — pass cases", () => {
  test("clean request with no headers passes", () => {
    const outcome = enforceDriftShield(makeRequest());
    assert.equal(outcome.pass, true);
  });

  test("pass result carries kernelSha and kernelVersion", () => {
    const outcome = enforceDriftShield(makeRequest());
    assert.equal(outcome.kernelSha,    KERNEL_SHA);
    assert.equal(outcome.kernelVersion, KERNEL_VERSION);
  });

  test("low WAF score (below threshold) passes", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "50" }));
    assert.equal(outcome.pass, true);
  });

  test("WAF score exactly at threshold passes (not strictly greater)", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "60" }));
    assert.equal(outcome.pass, true);
  });

  test("jitter header absent → zero-noise check passes", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "0" }));
    assert.equal(outcome.pass, true);
  });

  test("jitter header = '0' passes", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-averyos-jitter": "0" }));
    assert.equal(outcome.pass, true);
  });
});

// ── enforceDriftShield — block cases ─────────────────────────────────────────

describe("enforceDriftShield() — block cases", () => {
  test("WAF score above default threshold (60) → blocked", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "61" }));
    assert.equal(outcome.pass, false);
    if (!outcome.pass) {
      assert.equal(outcome.code, 403);
      assert.ok(outcome.reason.length > 0);
    }
  });

  test("WAF score 100 → blocked", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "100" }));
    assert.equal(outcome.pass, false);
  });

  test("jitter header = '1' → blocked (zero-noise mode)", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-averyos-jitter": "1" }));
    assert.equal(outcome.pass, false);
    if (!outcome.pass) {
      assert.equal(outcome.code, 403);
      assert.ok(outcome.reason.includes("jitter"));
    }
  });

  test("jitter check disabled when zeroNoise=false via env", () => {
    const env = { DRIFT_SHIELD_ZERO_NOISE: "0" };
    const outcome = enforceDriftShield(
      makeRequest({ "x-averyos-jitter": "1" }),
      env,
    );
    // Jitter should be ignored, no WAF score, so it passes
    assert.equal(outcome.pass, true);
  });

  test("block result carries kernelSha and kernelVersion", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "70" }));
    assert.equal(outcome.kernelSha,    KERNEL_SHA);
    assert.equal(outcome.kernelVersion, KERNEL_VERSION);
  });

  test("entropy check blocks when score below minimum", () => {
    const env = { DRIFT_SHIELD_ENTROPY_MIN: "5" };
    const outcome = enforceDriftShield(
      makeRequest({ "x-averyos-entropy": "2" }),
      env,
    );
    assert.equal(outcome.pass, false);
    if (!outcome.pass) {
      assert.ok(outcome.reason.includes("entropy"));
    }
  });

  test("entropy check blocks when header is absent and minimum > 0", () => {
    const env = { DRIFT_SHIELD_ENTROPY_MIN: "3" };
    const outcome = enforceDriftShield(makeRequest(), env);
    assert.equal(outcome.pass, false);
  });

  test("entropy check passes when value meets minimum", () => {
    const env = { DRIFT_SHIELD_ENTROPY_MIN: "3" };
    const outcome = enforceDriftShield(
      makeRequest({ "x-averyos-entropy": "5" }),
      env,
    );
    assert.equal(outcome.pass, true);
  });
});

// ── Block result HTTP code ────────────────────────────────────────────────────

describe("DriftShieldBlock.code values", () => {
  test("WAF block code is 403", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "99" }));
    assert.equal(outcome.pass, false);
    if (!outcome.pass) assert.equal(outcome.code, 403);
  });

  test("jitter block code is 403", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-averyos-jitter": "1" }));
    assert.equal(outcome.pass, false);
    if (!outcome.pass) assert.equal(outcome.code, 403);
  });
});

// ── Custom threshold via env ──────────────────────────────────────────────────

describe("enforceDriftShield() with custom threshold env", () => {
  test("custom threshold=80: score 70 passes", () => {
    const outcome = enforceDriftShield(
      makeRequest({ "x-waf-score": "70" }),
      { DRIFT_SHIELD_THRESHOLD: "80" },
    );
    assert.equal(outcome.pass, true);
  });

  test("custom threshold=80: score 81 is blocked", () => {
    const outcome = enforceDriftShield(
      makeRequest({ "x-waf-score": "81" }),
      { DRIFT_SHIELD_THRESHOLD: "80" },
    );
    assert.equal(outcome.pass, false);
  });
});
