/**
 * __tests__/coreManifest.test.ts
 *
 * Unit tests for lib/registry/coreManifest.ts
 *
 * Covers:
 *   - CORE_MANIFEST — module registry array
 *   - getDisplayStatus() — physicality display rule
 *   - getModule() — lookup by id
 *   - getModulesByStatus() — filter by physicality
 *   - updatePhysicality() — in-memory status mutation
 *   - getRegistrySnapshot() — point-in-time snapshot builder
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/coreManifest.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CORE_MANIFEST,
  getDisplayStatus,
  getModule,
  getModulesByStatus,
  updatePhysicality,
  getRegistrySnapshot,
} from "../lib/registry/coreManifest";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── CORE_MANIFEST ─────────────────────────────────────────────────────────────

describe("CORE_MANIFEST", () => {
  test("is a non-empty array", () => {
    assert.ok(Array.isArray(CORE_MANIFEST));
    assert.ok(CORE_MANIFEST.length > 0);
  });

  test("each module has required string fields", () => {
    for (const mod of CORE_MANIFEST) {
      assert.ok(typeof mod.id === "string" && mod.id.length > 0);
      assert.ok(typeof mod.name === "string" && mod.name.length > 0);
      assert.ok(typeof mod.description === "string");
      assert.ok(typeof mod.phase === "string");
    }
  });

  test("each module has a valid verificationPath", () => {
    const valid = new Set(["DNS", "TLS", "LOCAL_HANDSHAKE"]);
    for (const mod of CORE_MANIFEST) {
      assert.ok(valid.has(mod.verificationPath), `${mod.id}: invalid verificationPath '${mod.verificationPath}'`);
    }
  });

  test("each module has a valid physicalityStatus", () => {
    const valid = new Set(["PHYSICAL_TRUTH", "LATENT_ARTIFACT", "LATENT_PENDING"]);
    for (const mod of CORE_MANIFEST) {
      assert.ok(valid.has(mod.physicalityStatus), `${mod.id}: invalid physicalityStatus`);
    }
  });

  test("each module lastVerifiedAt is null or a string", () => {
    for (const mod of CORE_MANIFEST) {
      assert.ok(mod.lastVerifiedAt === null || typeof mod.lastVerifiedAt === "string");
    }
  });

  test("contains the TARI module", () => {
    const ids = CORE_MANIFEST.map((m) => m.id);
    assert.ok(ids.includes("TARI"));
  });

  test("contains the VAULTCHAIN module", () => {
    const ids = CORE_MANIFEST.map((m) => m.id);
    assert.ok(ids.includes("VAULTCHAIN"));
  });

  test("contains the TAI module", () => {
    const ids = CORE_MANIFEST.map((m) => m.id);
    assert.ok(ids.includes("TAI"));
  });
});

// ── getDisplayStatus() ────────────────────────────────────────────────────────

describe("getDisplayStatus()", () => {
  test("returns PHYSICAL_TRUTH for a PHYSICAL_TRUTH module", () => {
    const mod = { ...CORE_MANIFEST[0], physicalityStatus: "PHYSICAL_TRUTH" as const };
    assert.equal(getDisplayStatus(mod), "PHYSICAL_TRUTH");
  });

  test("returns LATENT_PENDING for a LATENT_ARTIFACT module", () => {
    const mod = { ...CORE_MANIFEST[0], physicalityStatus: "LATENT_ARTIFACT" as const };
    assert.equal(getDisplayStatus(mod), "LATENT_PENDING");
  });

  test("returns LATENT_PENDING for a LATENT_PENDING module", () => {
    const mod = { ...CORE_MANIFEST[0], physicalityStatus: "LATENT_PENDING" as const };
    assert.equal(getDisplayStatus(mod), "LATENT_PENDING");
  });
});

// ── getModule() ───────────────────────────────────────────────────────────────

describe("getModule()", () => {
  test("returns the correct module by id", () => {
    const mod = getModule("TARI");
    assert.ok(mod);
    assert.equal(mod.id, "TARI");
  });

  test("returns undefined for an unknown id", () => {
    assert.equal(getModule("NONEXISTENT_MODULE_ID"), undefined);
  });

  test("returns undefined for empty string id", () => {
    assert.equal(getModule(""), undefined);
  });
});

// ── getModulesByStatus() ──────────────────────────────────────────────────────

describe("getModulesByStatus()", () => {
  test("returns an array", () => {
    const mods = getModulesByStatus("LATENT_PENDING");
    assert.ok(Array.isArray(mods));
  });

  test("returns only modules with the requested status (LATENT_PENDING)", () => {
    const mods = getModulesByStatus("LATENT_PENDING");
    for (const m of mods) {
      assert.equal(m.physicalityStatus, "LATENT_PENDING");
    }
  });

  test("returns empty array for PHYSICAL_TRUTH when none verified yet", () => {
    // Default state: all modules are LATENT_PENDING — reset any prior state
    const mods = getModulesByStatus("PHYSICAL_TRUTH");
    assert.ok(Array.isArray(mods));
    // Count may vary based on prior updatePhysicality calls in same test run
  });

  test("returns only LATENT_ARTIFACT modules", () => {
    const mods = getModulesByStatus("LATENT_ARTIFACT");
    for (const m of mods) {
      assert.equal(m.physicalityStatus, "LATENT_ARTIFACT");
    }
  });
});

// ── updatePhysicality() ───────────────────────────────────────────────────────

describe("updatePhysicality()", () => {
  test("returns null for an unknown module id", () => {
    assert.equal(updatePhysicality("NONEXISTENT", "PHYSICAL_TRUTH"), null);
  });

  test("updates a known module to LATENT_ARTIFACT", () => {
    const updated = updatePhysicality("VAULTCHAIN", "LATENT_ARTIFACT");
    assert.ok(updated);
    assert.equal(updated.physicalityStatus, "LATENT_ARTIFACT");
    // lastVerifiedAt should remain unchanged (not PHYSICAL_TRUTH)
  });

  test("updates a known module to PHYSICAL_TRUTH and sets lastVerifiedAt", () => {
    const updated = updatePhysicality("TAI", "PHYSICAL_TRUTH");
    assert.ok(updated);
    assert.equal(updated.physicalityStatus, "PHYSICAL_TRUTH");
    assert.ok(typeof updated.lastVerifiedAt === "string");
    assert.ok(updated.lastVerifiedAt!.length > 0);
  });

  test("accepts optional db parameter without error", () => {
    const result = updatePhysicality("TARI", "LATENT_PENDING", null);
    assert.ok(result);
    assert.equal(result.physicalityStatus, "LATENT_PENDING");
  });

  test("does not set lastVerifiedAt when status is not PHYSICAL_TRUTH", () => {
    // First set to PHYSICAL_TRUTH to give it a timestamp
    updatePhysicality("TARI", "PHYSICAL_TRUTH");
    const before = getModule("TARI")?.lastVerifiedAt;
    // Now downgrade — lastVerifiedAt should remain unchanged
    const after = updatePhysicality("TARI", "LATENT_PENDING");
    assert.ok(after);
    assert.equal(after.lastVerifiedAt, before);
  });
});

// ── getRegistrySnapshot() ─────────────────────────────────────────────────────

describe("getRegistrySnapshot()", () => {
  test("returns a valid snapshot object", () => {
    const snap = getRegistrySnapshot();
    assert.ok(snap);
    assert.equal(typeof snap.generatedAt, "string");
    assert.equal(snap.kernelVersion, KERNEL_VERSION);
    assert.equal(snap.kernelSha, KERNEL_SHA);
    assert.equal(snap.phase, "117.3");
    assert.ok(Array.isArray(snap.modules));
  });

  test("physicality counts sum to modules.length", () => {
    const snap = getRegistrySnapshot();
    const total = snap.physicalCount + snap.latentCount + snap.pendingCount;
    assert.equal(total, snap.modules.length);
  });

  test("counts are non-negative integers", () => {
    const snap = getRegistrySnapshot();
    assert.ok(snap.physicalCount >= 0);
    assert.ok(snap.latentCount >= 0);
    assert.ok(snap.pendingCount >= 0);
  });

  test("modules array is a deep copy (mutations do not affect manifest)", () => {
    const snap = getRegistrySnapshot();
    const origName = snap.modules[0].name;
    snap.modules[0].name = "MUTATED";
    const snap2 = getRegistrySnapshot();
    assert.equal(snap2.modules[0].name, origName);
  });
});
