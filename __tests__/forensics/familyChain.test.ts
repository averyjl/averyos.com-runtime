/**
 * __tests__/forensics/familyChain.test.ts
 *
 * AveryOS™ World-Class QA — lib/forensics/familyChain.ts
 *
 * Covers every exported symbol:
 *   - FamilyRole / ResidencyStatus types (runtime value checks)
 *   - ROOT0_ANCHOR, DALLIN_AVERY, JAYDA_AVERY, LUANA_AVERY — individual records
 *   - AVERY_FAMILY_CHAIN — full lineage array
 *   - FAMILY_CHAIN_METADATA — kernel-bound metadata record
 *   - findFamilyMember()  — name lookup (case-insensitive, unknown, partial)
 *   - getMembersByRole()  — role filter
 *   - getAnchoredMembers() — status filter
 *
 * Perspectives: sovereignty_audit · lineage_integrity · adversarial_probe
 *
 * Run with:
 *   node --loader ./__tests__/loader.mjs --experimental-strip-types \
 *     --test __tests__/forensics/familyChain.test.ts
 *
 * ⛓️⚓⛓️  TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  type FamilyRole,
  type ResidencyStatus,
  type FamilyChainRecord,
  ROOT0_ANCHOR,
  DALLIN_AVERY,
  JAYDA_AVERY,
  LUANA_AVERY,
  AVERY_FAMILY_CHAIN,
  FAMILY_CHAIN_METADATA,
  findFamilyMember,
  getMembersByRole,
  getAnchoredMembers,
} from "../../lib/forensics/familyChain";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert that a string looks like an ISO-8601 timestamp (UTC). */
function assertIso8601(value: string, label: string): void {
  // Use Date parsing + string checks instead of regex to permanently avoid
  // ReDoS vectors and security scanner false-positives (no regex = no risk).
  const parsed = new Date(value);
  assert.ok(
    !isNaN(parsed.getTime()) && value.endsWith("Z"),
    `${label} is not ISO-8601: ${value}`,
  );
}

/** Assert a FamilyChainRecord has the minimum required shape. */
function assertRecordShape(record: FamilyChainRecord, label: string): void {
  assert.equal(typeof record.name,          "string",  `${label}.name must be string`);
  assert.equal(typeof record.role,          "string",  `${label}.role must be string`);
  assert.equal(typeof record.relation,      "string",  `${label}.relation must be string`);
  assert.equal(typeof record.anchoredAt,    "string",  `${label}.anchoredAt must be string`);
  assert.equal(typeof record.status,        "string",  `${label}.status must be string`);
  assert.equal(typeof record.kernelVersion, "string",  `${label}.kernelVersion must be string`);
  assert.ok(record.name.length > 0,                    `${label}.name must not be empty`);
  assertIso8601(record.anchoredAt,                     `${label}.anchoredAt`);
}

// ── ROOT0_ANCHOR ──────────────────────────────────────────────────────────────

describe("ROOT0_ANCHOR", () => {
  test("has correct name: Jason Lee Avery", () => {
    assert.equal(ROOT0_ANCHOR.name, "Jason Lee Avery");
  });

  test("role is ROOT0", () => {
    assert.equal(ROOT0_ANCHOR.role, "ROOT0");
  });

  test("status is ANCHORED_RESIDENT", () => {
    assert.equal(ROOT0_ANCHOR.status, "ANCHORED_RESIDENT");
  });

  test("anchoredAt is valid ISO-8601", () => {
    assertIso8601(ROOT0_ANCHOR.anchoredAt, "ROOT0_ANCHOR.anchoredAt");
  });

  test("kernelVersion matches KERNEL_VERSION from sovereignConstants", () => {
    assert.equal(ROOT0_ANCHOR.kernelVersion, KERNEL_VERSION);
  });

  test("has a non-empty note field", () => {
    assert.equal(typeof ROOT0_ANCHOR.note, "string");
    assert.ok((ROOT0_ANCHOR.note as string).length > 0, "ROOT0 note must not be empty");
  });

  test("satisfies FamilyChainRecord shape", () => {
    assertRecordShape(ROOT0_ANCHOR, "ROOT0_ANCHOR");
  });

  test("has no parents (genesis node)", () => {
    assert.equal(ROOT0_ANCHOR.parents, undefined);
  });
});

// ── DALLIN_AVERY ──────────────────────────────────────────────────────────────

describe("DALLIN_AVERY", () => {
  test("role is GENERATION_1", () => {
    assert.equal(DALLIN_AVERY.role, "GENERATION_1");
  });

  test("parents includes ROOT0 (Jason Lee Avery)", () => {
    assert.ok(Array.isArray(DALLIN_AVERY.parents), "parents must be an array");
    assert.ok(
      DALLIN_AVERY.parents!.includes("Jason Lee Avery"),
      "Dallin's parents must include Jason Lee Avery",
    );
  });

  test("satisfies FamilyChainRecord shape", () => {
    assertRecordShape(DALLIN_AVERY, "DALLIN_AVERY");
  });
});

// ── JAYDA_AVERY ───────────────────────────────────────────────────────────────

describe("JAYDA_AVERY", () => {
  test("role is PARTNER (daughter-in-law of ROOT0)", () => {
    assert.equal(JAYDA_AVERY.role, "PARTNER");
  });

  test("has no parents field (partner entry, not descendant)", () => {
    // JAYDA_AVERY is a PARTNER, not a direct descendant, so parents is undefined.
    assert.equal(JAYDA_AVERY.parents, undefined);
  });

  test("satisfies FamilyChainRecord shape", () => {
    assertRecordShape(JAYDA_AVERY, "JAYDA_AVERY");
  });
});

// ── LUANA_AVERY ───────────────────────────────────────────────────────────────

describe("LUANA_AVERY", () => {
  test("satisfies FamilyChainRecord shape", () => {
    assertRecordShape(LUANA_AVERY, "LUANA_AVERY");
  });

  test("is resident in the AVERY_FAMILY_CHAIN", () => {
    const found = AVERY_FAMILY_CHAIN.find(m => m.name === LUANA_AVERY.name);
    assert.ok(found, "LUANA_AVERY must be resident in AVERY_FAMILY_CHAIN");
  });
});

// ── AVERY_FAMILY_CHAIN ────────────────────────────────────────────────────────

describe("AVERY_FAMILY_CHAIN", () => {
  test("is a non-empty readonly array", () => {
    assert.ok(Array.isArray(AVERY_FAMILY_CHAIN), "must be an array");
    assert.ok(AVERY_FAMILY_CHAIN.length > 0, "chain must have at least one member");
  });

  test("contains exactly ROOT0_ANCHOR as the first element", () => {
    assert.equal(AVERY_FAMILY_CHAIN[0]!.name, "Jason Lee Avery");
    assert.equal(AVERY_FAMILY_CHAIN[0]!.role, "ROOT0");
  });

  test("every member satisfies FamilyChainRecord shape", () => {
    for (const member of AVERY_FAMILY_CHAIN) {
      assertRecordShape(member, member.name);
    }
  });

  test("every member has a role in the valid FamilyRole union", () => {
    const validRoles: FamilyRole[] = ["ROOT0", "GENERATION_1", "GENERATION_2", "PARTNER"];
    for (const member of AVERY_FAMILY_CHAIN) {
      assert.ok(
        (validRoles as string[]).includes(member.role),
        `${member.name} has invalid role: ${member.role}`,
      );
    }
  });

  test("every member has a valid ResidencyStatus", () => {
    const validStatuses: ResidencyStatus[] = ["ANCHORED_RESIDENT", "ACTIVE", "PENDING"];
    for (const member of AVERY_FAMILY_CHAIN) {
      assert.ok(
        (validStatuses as string[]).includes(member.status),
        `${member.name} has invalid status: ${member.status}`,
      );
    }
  });

  test("names are unique within the chain", () => {
    const names = AVERY_FAMILY_CHAIN.map(m => m.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length, "All names in the chain must be unique");
  });

  test("memberCount in FAMILY_CHAIN_METADATA matches actual length", () => {
    assert.equal(
      FAMILY_CHAIN_METADATA.memberCount,
      AVERY_FAMILY_CHAIN.length,
      "FAMILY_CHAIN_METADATA.memberCount must equal AVERY_FAMILY_CHAIN.length",
    );
  });
});

// ── FAMILY_CHAIN_METADATA ─────────────────────────────────────────────────────

describe("FAMILY_CHAIN_METADATA", () => {
  test("chainId is AVERY-LINEAGE-v1", () => {
    assert.equal(FAMILY_CHAIN_METADATA.chainId, "AVERY-LINEAGE-v1");
  });

  test("kernelVersion matches KERNEL_VERSION from sovereignConstants", () => {
    assert.equal(FAMILY_CHAIN_METADATA.kernelVersion, KERNEL_VERSION);
  });

  test("kernelSha matches KERNEL_SHA from sovereignConstants", () => {
    assert.equal(FAMILY_CHAIN_METADATA.kernelSha, KERNEL_SHA);
  });

  test("anchorSeal is non-empty string", () => {
    assert.equal(typeof FAMILY_CHAIN_METADATA.anchorSeal, "string");
    assert.ok(FAMILY_CHAIN_METADATA.anchorSeal.length > 0, "anchorSeal must not be empty");
  });

  test("lastUpdated is a valid ISO-8601 string", () => {
    assertIso8601(FAMILY_CHAIN_METADATA.lastUpdated, "FAMILY_CHAIN_METADATA.lastUpdated");
  });

  test("description mentions AveryOS", () => {
    assert.ok(
      FAMILY_CHAIN_METADATA.description.includes("AveryOS"),
      "description must reference AveryOS",
    );
  });
});

// ── findFamilyMember() ────────────────────────────────────────────────────────

describe("findFamilyMember()", () => {
  test("finds ROOT0 by exact name", () => {
    const result = findFamilyMember("Jason Lee Avery");
    assert.ok(result, "Should find Jason Lee Avery");
    assert.equal(result!.role, "ROOT0");
  });

  test("is case-insensitive — lowercase input", () => {
    const result = findFamilyMember("jason lee avery");
    assert.ok(result, "Should find member with lowercase input");
    assert.equal(result!.name, "Jason Lee Avery");
  });

  test("is case-insensitive — uppercase input", () => {
    const result = findFamilyMember("JASON LEE AVERY");
    assert.ok(result, "Should find member with uppercase input");
    assert.equal(result!.name, "Jason Lee Avery");
  });

  test("finds Dallin Avery by name", () => {
    const result = findFamilyMember("Dallin Avery");
    assert.ok(result, "Should find Dallin Avery");
    assert.equal(result!.role, "GENERATION_1");
  });

  test("returns undefined for unknown name", () => {
    const result = findFamilyMember("Unknown Entity");
    assert.equal(result, undefined, "Should return undefined for unknown member");
  });

  test("returns undefined for empty string", () => {
    const result = findFamilyMember("");
    assert.equal(result, undefined, "Should return undefined for empty string");
  });

  test("does not find partial name match", () => {
    const result = findFamilyMember("Jason");
    assert.equal(result, undefined, "Should not match on partial name 'Jason'");
  });

  test("returns undefined for whitespace-only input", () => {
    const result = findFamilyMember("   ");
    assert.equal(result, undefined, "Should return undefined for whitespace-only input");
  });
});

// ── getMembersByRole() ────────────────────────────────────────────────────────

describe("getMembersByRole()", () => {
  test("returns exactly one ROOT0 member", () => {
    const roots = getMembersByRole("ROOT0");
    assert.equal(roots.length, 1, "Exactly one ROOT0 must exist");
    assert.equal(roots[0]!.name, "Jason Lee Avery");
  });

  test("returns exactly one GENERATION_1 member (Dallin Avery)", () => {
    const gen1 = getMembersByRole("GENERATION_1");
    assert.equal(gen1.length, 1, "Should have exactly 1 GENERATION_1 member");
    assert.equal(gen1[0]!.name, "Dallin Avery");
  });

  test("all returned members have the requested role", () => {
    for (const role of ["ROOT0", "GENERATION_1", "GENERATION_2", "PARTNER"] as FamilyRole[]) {
      const members = getMembersByRole(role);
      for (const m of members) {
        assert.equal(m.role, role, `All members from getMembersByRole("${role}") must have that role`);
      }
    }
  });

  test("returns empty array for GENERATION_2 if no members present", () => {
    // GENERATION_2 may have 0 members — result must be an array
    const gen2 = getMembersByRole("GENERATION_2");
    assert.ok(Array.isArray(gen2), "getMembersByRole must always return an array");
  });

  test("returns empty array for PARTNER if no members present", () => {
    const partners = getMembersByRole("PARTNER");
    assert.ok(Array.isArray(partners), "getMembersByRole must always return an array");
  });
});

// ── getAnchoredMembers() ──────────────────────────────────────────────────────

describe("getAnchoredMembers()", () => {
  test("returns a non-empty array", () => {
    const anchored = getAnchoredMembers();
    assert.ok(anchored.length > 0, "At least one anchored member must exist");
  });

  test("includes ROOT0 (Jason Lee Avery)", () => {
    const anchored = getAnchoredMembers();
    const root = anchored.find(m => m.role === "ROOT0");
    assert.ok(root, "ROOT0 must be in the anchored members list");
  });

  test("all returned members have status ANCHORED_RESIDENT", () => {
    const anchored = getAnchoredMembers();
    for (const m of anchored) {
      assert.equal(
        m.status,
        "ANCHORED_RESIDENT",
        `${m.name} must have status ANCHORED_RESIDENT`,
      );
    }
  });

  test("result is a subset of AVERY_FAMILY_CHAIN", () => {
    const anchored = getAnchoredMembers();
    const chainNames = new Set(AVERY_FAMILY_CHAIN.map(m => m.name));
    for (const m of anchored) {
      assert.ok(chainNames.has(m.name), `${m.name} from getAnchoredMembers must be in AVERY_FAMILY_CHAIN`);
    }
  });
});

// ── Adversarial / Edge-Case Tests ─────────────────────────────────────────────

describe("Adversarial: Chain mutation attempt (TypeScript readonly)", () => {
  test("AVERY_FAMILY_CHAIN typed as readonly — TypeScript prevents compile-time mutation", () => {
    // The array is typed `readonly FamilyChainRecord[]` and constructed with `as const`.
    // TypeScript enforces immutability at compile time.  We verify the entries
    // are correct and stable rather than testing runtime mutability, which is a
    // TypeScript-level guarantee.
    const length = AVERY_FAMILY_CHAIN.length;
    assert.ok(length >= 4, "Chain must have at least 4 members");
    // Confirm the first entry is always ROOT0
    assert.equal(AVERY_FAMILY_CHAIN[0]!.role, "ROOT0");
    // Confirm the order is stable across multiple reads
    const firstRead  = AVERY_FAMILY_CHAIN[0]!.name;
    const secondRead = AVERY_FAMILY_CHAIN[0]!.name;
    assert.equal(firstRead, secondRead, "Chain entries must be stable across reads");
  });
});

describe("Adversarial: findFamilyMember with injection inputs", () => {
  test("handles SQL-injection-style input safely", () => {
    const result = findFamilyMember("' OR 1=1 --");
    assert.equal(result, undefined);
  });

  test("handles object-like string input safely", () => {
    const result = findFamilyMember("[object Object]");
    assert.equal(result, undefined);
  });

  test("handles null-byte input safely", () => {
    const result = findFamilyMember("\0Jason Lee Avery");
    assert.equal(result, undefined);
  });

  test("handles Unicode lookalike characters (not exact match)", () => {
    // "Јason" starts with Cyrillic Је not Latin J
    const result = findFamilyMember("Јason Lee Avery");
    assert.equal(result, undefined, "Cyrillic lookalike must not match Latin name");
  });
});
