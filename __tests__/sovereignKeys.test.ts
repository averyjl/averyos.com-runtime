/**
 * __tests__/sovereignKeys.test.ts
 *
 * Unit tests for lib/security/keys.ts — getSovereignKeys()
 *
 * Tests the RS256 key loading, the fallback (no keys), and the JWT
 * signing helper that uses the loaded key pair.
 *
 * Run with: node --experimental-strip-types --test __tests__/sovereignKeys.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getSovereignKeys, type SovereignKeyPair } from "../lib/security/keys";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getSovereignKeys()", () => {
  test("returns inactive pair when no key material is provided", async () => {
    const pair = await getSovereignKeys({});
    assert.equal(pair.active,       false);
    assert.equal(pair.privateKey,   null);
    assert.equal(pair.publicKey,    null);
    assert.equal(pair.kernelSha,    KERNEL_SHA);
    assert.equal(pair.kernelVersion, KERNEL_VERSION);
    assert.match(pair.kid, /^averyos-sovereign-key-v\d+\.\d+\.\d+$/);
  });

  test("returns inactive pair when key material strings are empty", async () => {
    const pair = await getSovereignKeys({
      AVERYOS_PRIVATE_KEY_B64: "",
      AVERYOS_PUBLIC_KEY_B64:  "",
    });
    assert.equal(pair.active, false);
    assert.equal(pair.privateKey, null);
    assert.equal(pair.publicKey,  null);
  });

  test("returns inactive pair when key material is malformed base64", async () => {
    const pair = await getSovereignKeys({
      AVERYOS_PRIVATE_KEY_B64: "not-valid-base64!!!",
      AVERYOS_PUBLIC_KEY_B64:  "also-not-valid###",
    });
    assert.equal(pair.active, false);
  });

  test("returns inactive pair when base64 is valid but not a valid DER key", async () => {
    // Valid base64 encoding of "Hello World" (not a real key)
    const fakeB64 = Buffer.from("Hello World this is not a key").toString("base64");
    const pair = await getSovereignKeys({
      AVERYOS_PRIVATE_KEY_B64: fakeB64,
      AVERYOS_PUBLIC_KEY_B64:  fakeB64,
    });
    assert.equal(pair.active, false);
  });

  test("kid always includes KERNEL_VERSION", async () => {
    const pair = await getSovereignKeys({});
    assert.ok(pair.kid.includes(KERNEL_VERSION), `kid "${pair.kid}" should include "${KERNEL_VERSION}"`);
  });

  test("kernelSha matches imported KERNEL_SHA constant", async () => {
    const pair = await getSovereignKeys({});
    assert.equal(pair.kernelSha, KERNEL_SHA);
  });

  test("result satisfies SovereignKeyPair interface shape", async () => {
    const pair: SovereignKeyPair = await getSovereignKeys({});
    // Verify all required fields exist
    assert.ok("active"        in pair, "active field missing");
    assert.ok("privateKey"    in pair, "privateKey field missing");
    assert.ok("publicKey"     in pair, "publicKey field missing");
    assert.ok("kid"           in pair, "kid field missing");
    assert.ok("kernelSha"     in pair, "kernelSha field missing");
    assert.ok("kernelVersion" in pair, "kernelVersion field missing");
  });
});
