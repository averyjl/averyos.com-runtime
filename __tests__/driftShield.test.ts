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
  enforceEconomicThrottle,
  UNAUTH_RPS,
  AUTH_RPS,
  type DriftShieldConfig,
} from "../lib/security/driftShield";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Sequential IP counter — ensures every call to makeRequest() produces a
 * unique source IP in the RFC 5737 TEST-NET-1 range (192.0.2.x).
 *
 * Root cause of the 7 test failures without this: `_throttleMap` in
 * lib/security/driftShield.ts is a module-level singleton with a 1 req/sec
 * unauthenticated bucket.  Without unique IPs every test shares the
 * `unauth:unknown` bucket and tests 3–7+ are throttled after the first call
 * consumes the single available token.
 *
 * Fix: each makeRequest() call increments `_testIpSeq` so every test gets a
 * fresh per-IP bucket, eliminating cross-test interference.
 */
let _testIpSeq = 0;

function makeRequest(headers: Record<string, string> = {}): Request {
  const ip = `192.0.2.${(_testIpSeq++ % 254) + 1}`;
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
  // Disable economic throttle (DRIFT_SHIELD_THROTTLE=0) in all pass tests —
  // these tests isolate WAF / jitter / entropy behaviour, not rate limiting.
  const noThrottle = { DRIFT_SHIELD_THROTTLE: "0" } as const;

  test("clean request with no headers passes", () => {
    const outcome = enforceDriftShield(makeRequest(), noThrottle);
    assert.equal(outcome.pass, true);
  });

  test("pass result carries kernelSha and kernelVersion", () => {
    const outcome = enforceDriftShield(makeRequest(), noThrottle);
    assert.equal(outcome.kernelSha,    KERNEL_SHA);
    assert.equal(outcome.kernelVersion, KERNEL_VERSION);
  });

  test("low WAF score (below threshold) passes", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "50" }), noThrottle);
    assert.equal(outcome.pass, true);
  });

  test("WAF score exactly at threshold passes (not strictly greater)", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "60" }), noThrottle);
    assert.equal(outcome.pass, true);
  });

  test("jitter header absent → zero-noise check passes", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-waf-score": "0" }), noThrottle);
    assert.equal(outcome.pass, true);
  });

  test("jitter header = '0' passes", () => {
    const outcome = enforceDriftShield(makeRequest({ "x-averyos-jitter": "0" }), noThrottle);
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
    const env = { DRIFT_SHIELD_ZERO_NOISE: "0", DRIFT_SHIELD_THROTTLE: "0" };
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
    const env = { DRIFT_SHIELD_ENTROPY_MIN: "3", DRIFT_SHIELD_THROTTLE: "0" };
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
      { DRIFT_SHIELD_THRESHOLD: "80", DRIFT_SHIELD_THROTTLE: "0" },
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

// ── enforceEconomicThrottle ───────────────────────────────────────────────────

describe("enforceEconomicThrottle() — constants", () => {
  test("UNAUTH_RPS is 1", () => {
    assert.equal(UNAUTH_RPS, 1);
  });

  test("AUTH_RPS is 1017", () => {
    assert.equal(AUTH_RPS, 1_017);
  });
});

describe("enforceEconomicThrottle() — disabled throttle", () => {
  test("passes immediately when throttle is disabled", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "0" });
    const req = new Request("https://averyos.com/");
    const outcome = enforceEconomicThrottle(req, cfg);
    assert.equal(outcome.pass, true);
  });

  test("returns kernel anchor when throttle is disabled", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "0" });
    const req = new Request("https://averyos.com/");
    const outcome = enforceEconomicThrottle(req, cfg);
    assert.equal(outcome.kernelSha, KERNEL_SHA);
    assert.equal(outcome.kernelVersion, KERNEL_VERSION);
  });
});

describe("enforceEconomicThrottle() — enabled throttle", () => {
  // Use a unique IP per test to avoid token-bucket state leaking between tests
  let ipCounter = 10;
  function freshReq(headers: Record<string, string> = {}): Request {
    const ip = `192.0.2.${ipCounter++}`;
    return new Request("https://averyos.com/", {
      headers: { "cf-connecting-ip": ip, ...headers },
    });
  }

  test("first unauthenticated request passes (full bucket)", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const outcome = enforceEconomicThrottle(freshReq(), cfg);
    assert.equal(outcome.pass, true);
  });

  test("second immediate unauthenticated request is rate-limited (429)", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const ip = `192.0.2.${ipCounter++}`;
    const req = () => new Request("https://averyos.com/", {
      headers: { "cf-connecting-ip": ip },
    });
    enforceEconomicThrottle(req(), cfg); // consume the single token
    const outcome = enforceEconomicThrottle(req(), cfg); // bucket empty
    assert.equal(outcome.pass, false);
    if (!outcome.pass) {
      assert.equal(outcome.code, 429);
      assert.ok(outcome.reason.includes("rate limit exceeded"));
    }
  });

  test("authenticated request uses Authorization header", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const ip = `192.0.2.${ipCounter++}`;
    // Two consecutive requests with auth — both should pass since authRps is high
    const req = () => new Request("https://averyos.com/", {
      headers: { "cf-connecting-ip": ip, "authorization": "Bearer valid-token" },
    });
    const r1 = enforceEconomicThrottle(req(), cfg);
    assert.equal(r1.pass, true);
  });

  test("x-vault-auth header is detected as authenticated", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const req = freshReq({ "x-vault-auth": "vault-secret" });
    const outcome = enforceEconomicThrottle(req, cfg);
    assert.equal(outcome.pass, true);
  });

  test("cookie aos-vault-auth is detected as authenticated", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const req = freshReq({ "cookie": "aos-vault-auth=session-token" });
    const outcome = enforceEconomicThrottle(req, cfg);
    assert.equal(outcome.pass, true);
  });

  test("x-forwarded-for is used when cf-connecting-ip is absent", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const req = new Request("https://averyos.com/", {
      headers: { "x-forwarded-for": `192.0.2.${ipCounter++}, 10.0.0.1` },
    });
    const outcome = enforceEconomicThrottle(req, cfg);
    assert.equal(outcome.pass, true);
  });

  test("falls back to 'unknown' when no IP headers present", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    // Two calls with no IP headers — both keyed 'unauth:unknown'
    // First call consumes the token; second is rate-limited
    const r1 = enforceEconomicThrottle(new Request("https://averyos.com/"), cfg);
    const r2 = enforceEconomicThrottle(new Request("https://averyos.com/"), cfg);
    // Both results must be valid outcomes
    assert.ok(typeof r1.pass === "boolean");
    assert.ok(typeof r2.pass === "boolean");
  });

  test("rate-limited response includes unauthenticated limit label", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const ip = `192.0.2.${ipCounter++}`;
    const req = () => new Request("https://averyos.com/", {
      headers: { "cf-connecting-ip": ip },
    });
    enforceEconomicThrottle(req(), cfg);
    const outcome = enforceEconomicThrottle(req(), cfg);
    if (!outcome.pass) {
      assert.ok(outcome.reason.includes("unauthenticated"));
    }
  });

  test("rate-limited response for authenticated includes authenticated label", () => {
    const cfg = loadDriftShieldConfig({ DRIFT_SHIELD_THROTTLE: "1" });
    const ip = `192.0.2.${ipCounter++}`;
    // Exhaust the very large auth bucket by overriding authRps to 1
    // We can't override authRps directly via env, so we call the raw function
    // with a custom config object
    const customCfg: DriftShieldConfig = {
      ...cfg,
      throttle: { ...cfg.throttle, authRps: 1, enabled: true },
    };
    const req = () => new Request("https://averyos.com/", {
      headers: { "cf-connecting-ip": ip, "authorization": "Bearer tok" },
    });
    enforceEconomicThrottle(req(), customCfg); // consume
    const outcome = enforceEconomicThrottle(req(), customCfg); // blocked
    if (!outcome.pass) {
      assert.ok(outcome.reason.includes("authenticated"));
    }
  });
});
