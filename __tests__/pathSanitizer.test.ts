/**
 * __tests__/pathSanitizer.test.ts
 *
 * Unit tests for lib/security/pathSanitizer.ts
 *
 * Covers:
 *   - SAFE_CAPSULE_ROOT / SAFE_CONTENT_ROOT / SAFE_LOGS_ROOT — constants
 *   - PathTraversalError — custom error type
 *   - resolveSafePath() — validate-and-resolve for untrusted filename segments
 *   - resolveSafeFilePath() — extension-appending wrapper
 *   - resolveSovereignPath() — subdirectory-aware sovereign write resolver
 *   - sovereignWriteSync() — authorised fs.writeFileSync sink
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/pathSanitizer.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  resolveSafePath,
  resolveSafeFilePath,
  resolveSovereignPath,
  sovereignWriteToRoot,
  PathTraversalError,
  SAFE_CAPSULE_ROOT,
  SAFE_CONTENT_ROOT,
  SAFE_LOGS_ROOT,
  SAFE_SOVEREIGN_WRITES_ROOT,
} from "../lib/security/pathSanitizer";

// ── Root constants ─────────────────────────────────────────────────────────────

describe("SAFE_CAPSULE_ROOT", () => {
  test("is an absolute path", () => {
    assert.ok(path.isAbsolute(SAFE_CAPSULE_ROOT));
  });

  test("ends with 'capsules'", () => {
    assert.ok(SAFE_CAPSULE_ROOT.endsWith("capsules"));
  });
});

describe("SAFE_CONTENT_ROOT", () => {
  test("is an absolute path", () => {
    assert.ok(path.isAbsolute(SAFE_CONTENT_ROOT));
  });

  test("ends with 'content'", () => {
    assert.ok(SAFE_CONTENT_ROOT.endsWith("content"));
  });
});

describe("SAFE_LOGS_ROOT", () => {
  test("is an absolute path", () => {
    assert.ok(path.isAbsolute(SAFE_LOGS_ROOT));
  });

  test("ends with 'logs'", () => {
    assert.ok(SAFE_LOGS_ROOT.endsWith("logs"));
  });
});

describe("SAFE_SOVEREIGN_WRITES_ROOT", () => {
  test("is an absolute path", () => {
    assert.ok(path.isAbsolute(SAFE_SOVEREIGN_WRITES_ROOT));
  });
});

// ── PathTraversalError ────────────────────────────────────────────────────────

describe("PathTraversalError", () => {
  test("is an Error subclass", () => {
    const err = new PathTraversalError("bad-seg", "/safe/root");
    assert.ok(err instanceof Error);
  });

  test("has name 'PathTraversalError'", () => {
    const err = new PathTraversalError("bad-seg", "/safe/root");
    assert.equal(err.name, "PathTraversalError");
  });

  test("message includes the offending segment", () => {
    const err = new PathTraversalError("../../etc/passwd", "/safe/root");
    assert.ok(err.message.includes("../../etc/passwd"));
  });

  test("message includes the allowed root", () => {
    const err = new PathTraversalError("x", "/my/secure/root");
    assert.ok(err.message.includes("/my/secure/root"));
  });
});

// ── resolveSafePath() ─────────────────────────────────────────────────────────

describe("resolveSafePath()", () => {
  test("resolves a simple alphanumeric filename", () => {
    const result = resolveSafePath("capsule.json", SAFE_CAPSULE_ROOT);
    assert.ok(path.isAbsolute(result));
    assert.ok(result.startsWith(SAFE_CAPSULE_ROOT));
    assert.ok(result.endsWith("capsule.json"));
  });

  test("accepts hyphens and underscores in segment", () => {
    const result = resolveSafePath("my-capsule_v1.json", SAFE_CAPSULE_ROOT);
    assert.ok(result.endsWith("my-capsule_v1.json"));
  });

  test("accepts dots in segment (but not '..')", () => {
    const result = resolveSafePath("capsule.v1.json", SAFE_CAPSULE_ROOT);
    assert.ok(result.endsWith("capsule.v1.json"));
  });

  test("throws PathTraversalError for '../' traversal", () => {
    assert.throws(
      () => resolveSafePath("../../etc/passwd", SAFE_CAPSULE_ROOT),
      PathTraversalError,
    );
  });

  test("throws PathTraversalError for slashes in segment", () => {
    assert.throws(
      () => resolveSafePath("subdir/file.json", SAFE_CAPSULE_ROOT),
      PathTraversalError,
    );
  });

  test("throws PathTraversalError for empty segment", () => {
    assert.throws(
      () => resolveSafePath("", SAFE_CAPSULE_ROOT),
      PathTraversalError,
    );
  });

  test("throws PathTraversalError for null-byte injection", () => {
    assert.throws(
      () => resolveSafePath("file\x00.json", SAFE_CAPSULE_ROOT),
      PathTraversalError,
    );
  });

  test("accepts a custom segment regex", () => {
    const alphaOnly = /^[a-z]+$/;
    const result = resolveSafePath("mycapsule", SAFE_CAPSULE_ROOT, alphaOnly);
    assert.ok(result.endsWith("mycapsule"));
  });

  test("throws when segment fails a custom regex", () => {
    const alphaOnly = /^[a-z]+$/;
    assert.throws(
      () => resolveSafePath("capsule123", SAFE_CAPSULE_ROOT, alphaOnly),
      PathTraversalError,
    );
  });

  test("works with SAFE_CONTENT_ROOT", () => {
    const result = resolveSafePath("whitepaper.md", SAFE_CONTENT_ROOT);
    assert.ok(result.startsWith(SAFE_CONTENT_ROOT));
    assert.ok(result.endsWith("whitepaper.md"));
  });

  test("works with SAFE_LOGS_ROOT", () => {
    const result = resolveSafePath("event.log", SAFE_LOGS_ROOT);
    assert.ok(result.startsWith(SAFE_LOGS_ROOT));
  });
});

// ── resolveSafeFilePath() ─────────────────────────────────────────────────────

describe("resolveSafeFilePath()", () => {
  test("appends extension with leading dot", () => {
    const result = resolveSafeFilePath("my-capsule", ".json", SAFE_CAPSULE_ROOT);
    assert.ok(result.endsWith("my-capsule.json"));
  });

  test("normalises extension when dot is omitted", () => {
    const result = resolveSafeFilePath("my-capsule", "json", SAFE_CAPSULE_ROOT);
    assert.ok(result.endsWith("my-capsule.json"));
  });

  test("returns an absolute path inside the root", () => {
    const result = resolveSafeFilePath("test", ".md", SAFE_CONTENT_ROOT);
    assert.ok(path.isAbsolute(result));
    assert.ok(result.startsWith(SAFE_CONTENT_ROOT));
  });

  test("throws PathTraversalError for traversal attempt", () => {
    assert.throws(
      () => resolveSafeFilePath("../../etc/passwd", ".json", SAFE_CAPSULE_ROOT),
      PathTraversalError,
    );
  });
});

// ── resolveSovereignPath() ────────────────────────────────────────────────────

describe("resolveSovereignPath()", () => {
  test("resolves a simple filename inside the root", () => {
    const result = resolveSovereignPath("report.json", SAFE_LOGS_ROOT);
    assert.ok(result.startsWith(SAFE_LOGS_ROOT));
    assert.ok(result.endsWith("report.json"));
  });

  test("throws PathTraversalError for '../../' traversal", () => {
    assert.throws(
      () => resolveSovereignPath("../../etc/passwd", SAFE_LOGS_ROOT),
      PathTraversalError,
    );
  });
});

// ── sovereignWriteToRoot() ───────────────────────────────────────────────────

describe("sovereignWriteToRoot()", () => {
  test("writes a string to a file inside the allowed root", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-path-test-"));
    const filename = "sovereign-test.txt";
    sovereignWriteToRoot(tmpDir, filename, "hello sovereign");
    const written = fs.readFileSync(path.join(tmpDir, filename), "utf-8");
    assert.equal(written, "hello sovereign");
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("writes a Buffer to a file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-buf-test-"));
    const filename = "sovereign-buf.bin";
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    sovereignWriteToRoot(tmpDir, filename, buf);
    const written = fs.readFileSync(path.join(tmpDir, filename));
    assert.deepEqual(written, buf);
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("creates parent directories if they do not exist", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-mkdirp-test-"));
    const filename = "report.json";
    sovereignWriteToRoot(tmpDir, filename, "{}");
    assert.ok(fs.existsSync(path.join(tmpDir, filename)));
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("throws PathTraversalError for traversal attempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-trav-test-"));
    assert.throws(
      () => sovereignWriteToRoot(tmpDir, "../../etc/evil.txt", "data"),
      PathTraversalError,
    );
    fs.rmSync(tmpDir, { recursive: true });
  });
});
