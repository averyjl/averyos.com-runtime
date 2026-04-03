/**
 * __tests__/agentSummary.test.ts
 *
 * Unit tests for lib/forensics/agentSummary.ts
 *
 * Covers:
 *   - buildAgentSummaryJson() — synchronous record builder (no I/O)
 *   - writeAgentSummary() — async append-to-disk + returns record
 *   - AGENT_SUMMARY_LOG_PATH — path constant
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/agentSummary.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentSummaryJson,
  writeAgentSummary,
  AGENT_SUMMARY_LOG_PATH,
} from "../lib/forensics/agentSummary";
import { KERNEL_SHA, KERNEL_VERSION } from "../lib/sovereignConstants";

// ── AGENT_SUMMARY_LOG_PATH ────────────────────────────────────────────────────

describe("AGENT_SUMMARY_LOG_PATH", () => {
  test("points to logs/agent_summary.aosvault", () => {
    assert.equal(AGENT_SUMMARY_LOG_PATH, "logs/agent_summary.aosvault");
  });
});

// ── buildAgentSummaryJson() ───────────────────────────────────────────────────

describe("buildAgentSummaryJson()", () => {
  test("returns a valid JSON string", () => {
    const json = buildAgentSummaryJson({ summary: "Test session" });
    assert.equal(typeof json, "string");
    // Must be parseable
    const record = JSON.parse(json);
    assert.ok(record);
  });

  test("record schema is always AOSR-1.0", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.equal(record.schema, "AOSR-1.0");
  });

  test("embeds the sovereign kernel anchor", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.equal(record.kernelSha, KERNEL_SHA);
    assert.equal(record.kernelVersion, KERNEL_VERSION);
  });

  test("uses supplied summary string", () => {
    const record = JSON.parse(
      buildAgentSummaryJson({ summary: "Phase 126.2 complete" }),
    );
    assert.equal(record.summary, "Phase 126.2 complete");
  });

  test("defaults agentId to 'copilot'", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.equal(record.agentId, "copilot");
  });

  test("defaults phase to '117.3'", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.equal(record.phase, "117.3");
  });

  test("defaults gatesCompleted to []", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.deepEqual(record.gatesCompleted, []);
  });

  test("defaults usiCount, physicalCount, latentCount to 0", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.equal(record.usiCount, 0);
    assert.equal(record.physicalCount, 0);
    assert.equal(record.latentCount, 0);
  });

  test("defaults merkleRoot to 'PENDING'", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.equal(record.merkleRoot, "PENDING");
  });

  test("accepts custom agentId, phase, sessionId", () => {
    const record = JSON.parse(
      buildAgentSummaryJson({
        summary: "Custom test",
        agentId: "claude",
        phase: "126.2",
        sessionId: "test-session-126",
      }),
    );
    assert.equal(record.agentId, "claude");
    assert.equal(record.phase, "126.2");
    assert.equal(record.sessionId, "test-session-126");
  });

  test("accepts all optional fields", () => {
    const record = JSON.parse(
      buildAgentSummaryJson({
        summary: "Full test",
        agentId: "gemini",
        phase: "126.2",
        sessionId: "s-123",
        gatesCompleted: ["126.2.1", "126.2.2", "126.2.3"],
        usiCount: 2,
        physicalCount: 5,
        latentCount: 3,
        merkleRoot: "abc123def",
      }),
    );
    assert.equal(record.agentId, "gemini");
    assert.deepEqual(record.gatesCompleted, ["126.2.1", "126.2.2", "126.2.3"]);
    assert.equal(record.usiCount, 2);
    assert.equal(record.physicalCount, 5);
    assert.equal(record.latentCount, 3);
    assert.equal(record.merkleRoot, "abc123def");
  });

  test("auto-generates sessionId when omitted", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.ok(typeof record.sessionId === "string");
    assert.ok(record.sessionId.length > 0);
  });

  test("completedAt is an ISO-9 timestamp string", () => {
    const record = JSON.parse(buildAgentSummaryJson({ summary: "s" }));
    assert.ok(typeof record.completedAt === "string");
    assert.ok(record.completedAt.length > 0);
  });
});

// ── writeAgentSummary() ───────────────────────────────────────────────────────

describe("writeAgentSummary()", () => {
  test("returns the AOSR record (schema, kernelSha)", async () => {
    const record = await writeAgentSummary({ summary: "Write test" });
    assert.equal(record.schema, "AOSR-1.0");
    assert.equal(record.kernelSha, KERNEL_SHA);
    assert.equal(record.summary, "Write test");
  });

  test("returns record with correct defaults", async () => {
    const record = await writeAgentSummary({ summary: "Defaults check" });
    assert.equal(record.agentId, "copilot");
    assert.equal(record.phase, "117.3");
    assert.deepEqual(record.gatesCompleted, []);
    assert.equal(record.usiCount, 0);
    assert.equal(record.merkleRoot, "PENDING");
  });

  test("accepts custom fields", async () => {
    const record = await writeAgentSummary({
      summary: "Custom write",
      agentId: "gemini",
      phase: "126.2",
      gatesCompleted: ["126.2.3"],
      usiCount: 1,
      physicalCount: 2,
      latentCount: 1,
      merkleRoot: "def456",
    });
    assert.equal(record.agentId, "gemini");
    assert.equal(record.phase, "126.2");
    assert.equal(record.merkleRoot, "def456");
    assert.deepEqual(record.gatesCompleted, ["126.2.3"]);
  });

  test("returns a string completedAt", async () => {
    const record = await writeAgentSummary({ summary: "ts check" });
    assert.ok(typeof record.completedAt === "string");
    assert.ok(record.completedAt.length > 0);
  });
});
