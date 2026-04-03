/**
 * __tests__/meshDiscovery.test.ts
 *
 * Unit tests for lib/ai/meshDiscovery.ts
 *
 * Covers:
 *   - discoverMeshNodes() — main entry point
 *     • no KV binding (env = {})
 *     • mock KV binding with empty list
 *     • mock KV binding with aligned entries
 *     • mock KV binding with misaligned entries
 *     • mock KV binding with null get() result
 *     • mock KV binding with non-JSON value
 *     • mock KV binding that throws on list()
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/meshDiscovery.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { discoverMeshNodes } from "../lib/ai/meshDiscovery";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Helper: mock KV namespace factory ────────────────────────────────────────

function makeMockKV(opts: {
  keys?: Array<{ name: string }>;
  getValue?: (key: string) => Promise<string | null>;
  listThrows?: boolean;
}) {
  return {
    list: opts.listThrows
      ? async () => { throw new Error("KV unavailable"); }
      : async () => ({ keys: opts.keys ?? [] }),
    get: opts.getValue ?? (async () => null),
  };
}

// ── discoverMeshNodes() ───────────────────────────────────────────────────────

describe("discoverMeshNodes()", () => {
  test("returns a well-shaped MeshDiscoveryResult", async () => {
    const result = await discoverMeshNodes({});
    assert.equal(result.kernel_version, KERNEL_VERSION);
    assert.equal(result.kernel_sha, KERNEL_SHA);
    assert.ok(Array.isArray(result.nodes));
    assert.equal(typeof result.total_found, "number");
    assert.equal(typeof result.total_aligned, "number");
    assert.ok(typeof result.scan_started_at === "string");
    assert.ok(typeof result.scan_ended_at === "string");
    assert.ok(Array.isArray(result.backends_scanned));
  });

  test("returns zero nodes and empty backends when no KV binding is provided", async () => {
    const result = await discoverMeshNodes({});
    assert.equal(result.total_found, 0);
    assert.equal(result.total_aligned, 0);
    assert.deepEqual(result.nodes, []);
    assert.deepEqual(result.backends_scanned, []);
  });

  test("includes 'cloudflare_kv' in backends_scanned when AVERY_KV is provided", async () => {
    const mockKV = makeMockKV({ keys: [] });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.ok(result.backends_scanned.includes("cloudflare_kv"));
  });

  test("returns zero nodes when KV list is empty", async () => {
    const mockKV = makeMockKV({ keys: [] });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 0);
    assert.equal(result.total_aligned, 0);
  });

  test("counts an aligned node when KV value contains matching kernel_sha", async () => {
    const mockKV = makeMockKV({
      keys: [{ name: "averyos-capsules/aligned-capsule" }],
      getValue: async () => JSON.stringify({ kernel_sha: KERNEL_SHA }),
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 1);
    assert.equal(result.total_aligned, 1);
    assert.equal(result.nodes[0].aligned, true);
    assert.equal(result.nodes[0].anchor_sha, KERNEL_SHA);
    assert.equal(result.nodes[0].backend, "cloudflare_kv");
  });

  test("counts a misaligned node when KV value contains wrong kernel_sha", async () => {
    const mockKV = makeMockKV({
      keys: [{ name: "averyos-capsules/misaligned" }],
      getValue: async () => JSON.stringify({ kernel_sha: "wrong-sha-not-matching" }),
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 1);
    assert.equal(result.total_aligned, 0);
    assert.equal(result.nodes[0].aligned, false);
    assert.equal(result.nodes[0].anchor_sha, "wrong-sha-not-matching");
  });

  test("handles null KV get() values gracefully (anchor_sha = null)", async () => {
    const mockKV = makeMockKV({
      keys: [{ name: "averyos-capsules/empty-capsule" }],
      getValue: async () => null,
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 1);
    assert.equal(result.nodes[0].anchor_sha, null);
    assert.equal(result.nodes[0].aligned, false);
  });

  test("handles non-JSON KV values gracefully (anchor_sha = null)", async () => {
    const mockKV = makeMockKV({
      keys: [{ name: "averyos-capsules/opaque" }],
      getValue: async () => "this-is-not-json",
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 1);
    assert.equal(result.nodes[0].anchor_sha, null);
    assert.equal(result.nodes[0].aligned, false);
  });

  test("handles KV values with non-string kernel_sha field", async () => {
    const mockKV = makeMockKV({
      keys: [{ name: "averyos-capsules/bad-type" }],
      getValue: async () => JSON.stringify({ kernel_sha: 12345 }),
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 1);
    assert.equal(result.nodes[0].anchor_sha, null);
    assert.equal(result.nodes[0].aligned, false);
  });

  test("handles KV list() throwing an error gracefully (total_found=0)", async () => {
    const mockKV = makeMockKV({ listThrows: true });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 0);
    // 'cloudflare_kv' is still in backends_scanned because we attempted the scan
    assert.ok(result.backends_scanned.includes("cloudflare_kv"));
  });

  test("processes multiple KV entries correctly", async () => {
    const mockKV = makeMockKV({
      keys: [
        { name: "averyos-capsules/cap-a" },
        { name: "averyos-capsules/cap-b" },
        { name: "averyos-capsules/cap-c" },
      ],
      getValue: async (key: string) => {
        if (key.endsWith("cap-a")) return JSON.stringify({ kernel_sha: KERNEL_SHA });
        if (key.endsWith("cap-b")) return JSON.stringify({ kernel_sha: "other" });
        return null;
      },
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.total_found, 3);
    assert.equal(result.total_aligned, 1);
  });

  test("node reference and id match the KV key name", async () => {
    const keyName = "averyos-capsules/ref-test";
    const mockKV = makeMockKV({
      keys: [{ name: keyName }],
      getValue: async () => null,
    });
    const result = await discoverMeshNodes({ AVERY_KV: mockKV });
    assert.equal(result.nodes[0].id, keyName);
    assert.equal(result.nodes[0].reference, keyName);
  });

  test("scan_started_at is before or equal to scan_ended_at", async () => {
    const result = await discoverMeshNodes({});
    const start = new Date(result.scan_started_at).getTime();
    const end   = new Date(result.scan_ended_at).getTime();
    assert.ok(start <= end);
  });
});
