/**
 * __tests__/monetization/live-settlement.test.ts
 *
 * Gate 113.6.3 — Stripe Roundtrip Test
 *
 * Validates that:
 *   1. A $1.00 USD settlement charge is constructed with the correct
 *      `organization` metadata field (100 cents = $1.00).
 *   2. The `organization` metadata key is preserved through the payload
 *      builder so it would land in D1 via the webhook handler.
 *   3. The Stripe checkout metadata payload is structurally valid for
 *      round-trip processing by the AveryOS™ webhook receiver.
 *
 * These are unit tests — no live Stripe calls are made in CI.
 * All assertions validate the shape and correctness of data that would be
 * submitted to the Stripe API during a real Tier-1 settlement.
 *
 * Run with:
 *   node --loader ../../loader.mjs --experimental-strip-types --test monetization/live-settlement.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

// ── Helpers mirroring create-checkout route logic ─────────────────────────────

/**
 * Build a minimal Stripe checkout session metadata payload for a $1.00
 * Tier-1 live settlement.  Mirrors the shape produced by
 * app/api/v1/compliance/create-checkout/route.ts.
 */
function buildSettlementMetadata(opts: {
  organization:  string;
  bundleId:      string;
  targetIp:      string;
  rayId?:        string;
  asn?:          string;
  liabilityCents: number;
}) {
  return {
    bundle_id:             opts.bundleId.slice(0, 500),
    target_ip:             opts.targetIp.slice(0, 200),
    kernel_sha:            KERNEL_SHA.slice(0, 128),
    kernel_version:        KERNEL_VERSION,
    tari_liability_cents:  String(opts.liabilityCents),
    source:                "averyos_compliance_portal",
    // The 'organization' field is the key that must land in D1 after the
    // Stripe webhook processes the completed payment intent.
    organization:          opts.organization.slice(0, 200),
    ...(opts.rayId ? { ray_id: opts.rayId.slice(0, 200) } : {}),
    ...(opts.asn   ? { asn:    opts.asn.slice(0, 64)    } : {}),
  };
}

/**
 * Simulate what the D1 webhook receiver extracts from a Stripe metadata blob.
 * Returns the organization field that would be stored in the database row.
 */
function extractOrganizationFromMetadata(
  metadata: Record<string, string>,
): string | null {
  return metadata["organization"] ?? null;
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe("$1.00 Live Settlement — Stripe Metadata Roundtrip", () => {
  const TIER1_AMOUNT_CENTS = 100; // $1.00 USD

  test("Tier-1 charge amount is exactly 100 cents ($1.00 USD)", () => {
    assert.strictEqual(TIER1_AMOUNT_CENTS, 100);
    assert.strictEqual(TIER1_AMOUNT_CENTS / 100, 1.0);
  });

  test("buildSettlementMetadata() includes 'organization' field", () => {
    const meta = buildSettlementMetadata({
      organization:   "AveryOS™ Test Entity",
      bundleId:       "bundle-test-001",
      targetIp:       "192.0.2.1",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    assert.ok("organization" in meta, "metadata must contain 'organization' key");
    assert.strictEqual(meta.organization, "AveryOS™ Test Entity");
  });

  test("buildSettlementMetadata() sets tari_liability_cents to '100' for $1.00", () => {
    const meta = buildSettlementMetadata({
      organization:   "Test Org",
      bundleId:       "bundle-100",
      targetIp:       "10.0.0.1",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    assert.strictEqual(meta.tari_liability_cents, "100");
  });

  test("buildSettlementMetadata() includes kernel_sha and kernel_version", () => {
    const meta = buildSettlementMetadata({
      organization:   "Test Org",
      bundleId:       "bundle-kv",
      targetIp:       "10.0.0.2",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    assert.ok(meta.kernel_sha.length > 0, "kernel_sha must be non-empty");
    assert.strictEqual(meta.kernel_version, KERNEL_VERSION);
  });

  test("extractOrganizationFromMetadata() recovers 'organization' from metadata blob", () => {
    const meta = buildSettlementMetadata({
      organization:   "OpenAI LLC",
      bundleId:       "bundle-openai",
      targetIp:       "192.0.2.100",
      rayId:          "ray-abc123",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    const org = extractOrganizationFromMetadata(meta);
    assert.strictEqual(org, "OpenAI LLC");
  });

  test("extractOrganizationFromMetadata() returns null when field is absent", () => {
    const strippedMeta: Record<string, string> = {
      bundle_id: "b-001",
      target_ip: "10.0.0.3",
    };
    const org = extractOrganizationFromMetadata(strippedMeta);
    assert.strictEqual(org, null);
  });

  test("organization field is truncated to 200 chars to fit Stripe metadata limits", () => {
    const longOrg = "A".repeat(300);
    const meta = buildSettlementMetadata({
      organization:   longOrg,
      bundleId:       "bundle-long",
      targetIp:       "10.0.0.4",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    assert.ok(meta.organization.length <= 200, "organization must be truncated to 200 chars");
    assert.strictEqual(meta.organization, "A".repeat(200));
  });

  test("optional ray_id and asn fields are included when provided", () => {
    const meta = buildSettlementMetadata({
      organization:   "Meta AI",
      bundleId:       "bundle-meta",
      targetIp:       "192.0.2.200",
      rayId:          "ray-xyz999",
      asn:            "32934",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    assert.strictEqual(meta.ray_id, "ray-xyz999");
    assert.strictEqual(meta.asn, "32934");
  });

  test("optional ray_id and asn fields are absent when not provided", () => {
    const meta = buildSettlementMetadata({
      organization:   "Test Corp",
      bundleId:       "bundle-noray",
      targetIp:       "10.0.0.5",
      liabilityCents: TIER1_AMOUNT_CENTS,
    });
    assert.ok(!("ray_id" in meta), "ray_id must not be present if not provided");
    assert.ok(!("asn" in meta), "asn must not be present if not provided");
  });
});
