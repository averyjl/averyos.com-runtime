/**
 * __tests__/sovereignFetch.test.ts
 *
 * Unit tests for lib/security/sovereignFetch.ts
 *
 * Covers:
 *   - universalFetch() — PhysicalityStatus determination:
 *       PHYSICAL_TRUTH  → successful response + cf-ray header (or cfRay not required)
 *       LATENT_ARTIFACT → successful response but no cf-ray header
 *       LATENT_PENDING  → failed / timed-out call
 *   - ensureSovereignFetchLog() — D1 table creation helper
 *
 * Strategy: globalThis.fetch is mocked using Node.js built-in test mock
 * utilities so that no real network calls are made.
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/sovereignFetch.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { universalFetch, ensureSovereignFetchLog } from "../lib/security/sovereignFetch";

// ── Minimal mock helpers ──────────────────────────────────────────────────────

/** Build a mock fetch function that returns a configurable Response. */
function makeMockFetch(opts: {
  ok?: boolean;
  status?: number;
  cfRay?: string | null;
  body?: string;
}): typeof fetch {
  return async () => {
    const headers = new Headers();
    if (opts.cfRay) {
      headers.set("cf-ray", opts.cfRay);
    }
    return new Response(opts.body ?? "ok", {
      status: opts.status ?? 200,
      headers,
    });
  };
}

/** Build a mock fetch that throws (simulates network failure). */
function makeMockFetchThrows(message = "Network error"): typeof fetch {
  return async () => { throw new Error(message); };
}

/** Minimal D1-like mock that accepts SQL but does nothing. */
function makeMockD1() {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        run: async () => {},
      }),
    }),
  };
}

// ── Store the original fetch to restore after each test ───────────────────────

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

// ── universalFetch() ──────────────────────────────────────────────────────────

describe("universalFetch() — PHYSICAL_TRUTH path", () => {
  test("assigns PHYSICAL_TRUTH when response is ok and cf-ray is present", async () => {
    globalThis.fetch = makeMockFetch({ ok: true, status: 200, cfRay: "test-ray-001" });
    const result = await universalFetch(
      "https://api.example.com/test",
      { method: "GET" },
      { serviceName: "TestService", requireCfRay: true, db: null },
    );
    assert.equal(result.physicalityStatus, "PHYSICAL_TRUTH");
    assert.equal(result.cfRay, "test-ray-001");
    assert.ok(result.merkleLeaf !== null);
  });

  test("assigns PHYSICAL_TRUTH when requireCfRay=false and response is ok (no ray needed)", async () => {
    globalThis.fetch = makeMockFetch({ ok: true, status: 200, cfRay: null });
    const result = await universalFetch(
      "https://api.example.com/no-ray",
      { method: "GET" },
      { serviceName: "NoRayService", requireCfRay: false, db: null },
    );
    assert.equal(result.physicalityStatus, "PHYSICAL_TRUTH");
    assert.ok(result.merkleLeaf !== null);
  });

  test("merkleLeaf is a non-empty hex string on PHYSICAL_TRUTH", async () => {
    globalThis.fetch = makeMockFetch({ ok: true, status: 200, cfRay: "ray-abc" });
    const result = await universalFetch(
      "https://api.example.com/merkle",
      undefined,
      { serviceName: "MerkleService", requireCfRay: true, db: null },
    );
    assert.equal(result.physicalityStatus, "PHYSICAL_TRUTH");
    assert.ok(typeof result.merkleLeaf === "string");
    assert.ok(result.merkleLeaf!.length > 0);
  });

  test("completedAt is a string on every result", async () => {
    globalThis.fetch = makeMockFetch({ ok: true, status: 200, cfRay: "ray-ts" });
    const result = await universalFetch(
      "https://api.example.com/ts",
      undefined,
      { serviceName: "TsService", requireCfRay: true, db: null },
    );
    assert.ok(typeof result.completedAt === "string");
    assert.ok(result.completedAt.length > 0);
  });
});

describe("universalFetch() — LATENT_ARTIFACT path", () => {
  test("assigns LATENT_ARTIFACT when response is ok but no cf-ray header", async () => {
    globalThis.fetch = makeMockFetch({ ok: true, status: 200, cfRay: null });
    const result = await universalFetch(
      "https://non-cloudflare.example.com/resource",
      { method: "GET" },
      { serviceName: "NonCFService", requireCfRay: true, db: null },
    );
    assert.equal(result.physicalityStatus, "LATENT_ARTIFACT");
    assert.equal(result.cfRay, null);
    assert.ok(result.merkleLeaf !== null);
  });
});

describe("universalFetch() — LATENT_PENDING path", () => {
  test("assigns LATENT_PENDING when fetch throws (network error)", async () => {
    globalThis.fetch = makeMockFetchThrows("Connection refused");
    const result = await universalFetch(
      "https://unreachable.example.com/api",
      { method: "GET" },
      { serviceName: "DeadService", requireCfRay: true, db: null },
    );
    assert.equal(result.physicalityStatus, "LATENT_PENDING");
    assert.equal(result.cfRay, null);
    assert.equal(result.merkleLeaf, null);
  });

  test("assigns LATENT_PENDING when fetch returns a 5xx status", async () => {
    globalThis.fetch = makeMockFetch({ ok: false, status: 500, cfRay: "ray-500" });
    const result = await universalFetch(
      "https://api.example.com/error",
      { method: "GET" },
      { serviceName: "ErrorService", requireCfRay: true, db: null },
    );
    assert.equal(result.physicalityStatus, "LATENT_PENDING");
    assert.equal(result.merkleLeaf, null);
  });
});

describe("universalFetch() — VaultChain persistence", () => {
  test("calls db.prepare when merkleLeaf is non-null and db is provided", async () => {
    let prepareCalled = false;
    const mockD1 = {
      prepare: (_sql: string) => {
        prepareCalled = true;
        return {
          bind: (..._args: unknown[]) => ({
            run: async () => {},
          }),
        };
      },
    };
    globalThis.fetch = makeMockFetch({ ok: true, status: 200, cfRay: "ray-vault" });
    await universalFetch(
      "https://api.example.com/vault",
      undefined,
      { serviceName: "VaultService", requireCfRay: true, db: mockD1 },
    );
    assert.ok(prepareCalled, "Expected db.prepare to be called for VaultChain anchor");
  });

  test("merkleLeaf is null when physicality is LATENT_PENDING", async () => {
    globalThis.fetch = makeMockFetchThrows();
    const result = await universalFetch(
      "https://api.example.com/failed",
      undefined,
      { serviceName: "FailedService2", db: null },
    );
    // No VaultChain anchor should be computed when the call failed.
    assert.equal(result.merkleLeaf, null);
    assert.equal(result.physicalityStatus, "LATENT_PENDING");
  });
});

// ── ensureSovereignFetchLog() ─────────────────────────────────────────────────

describe("ensureSovereignFetchLog()", () => {
  test("calls db.prepare with a CREATE TABLE statement", async () => {
    let sql = "";
    const mockD1 = makeMockD1();
    const spied = {
      prepare: (s: string) => {
        sql = s;
        return mockD1.prepare(s);
      },
    };
    await ensureSovereignFetchLog(spied);
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS sovereign_fetch_log"));
  });
});
