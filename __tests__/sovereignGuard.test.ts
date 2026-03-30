/**
 * __tests__/sovereignGuard.test.ts
 *
 * Unit tests for lib/security/sovereignGuard.ts
 *
 * Covers:
 *   - VAULT_STORAGE_ROOT — vault write root constant
 *   - SovereignGuardError — custom error type
 *   - resolveGuardedPath() — basename-only secure path resolver
 *   - guardedWrite() — authorised vault write sink
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/sovereignGuard.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import {
  resolveGuardedPath,
  guardedWrite,
  VAULT_STORAGE_ROOT,
  SovereignGuardError,
} from "../lib/security/sovereignGuard";

// ── VAULT_STORAGE_ROOT ────────────────────────────────────────────────────────

describe("VAULT_STORAGE_ROOT", () => {
  test("is an absolute path", () => {
    assert.ok(path.isAbsolute(VAULT_STORAGE_ROOT));
  });

  test("ends with 'vault_storage'", () => {
    assert.ok(VAULT_STORAGE_ROOT.endsWith("vault_storage"));
  });
});

// ── SovereignGuardError ───────────────────────────────────────────────────────

describe("SovereignGuardError", () => {
  test("is an Error subclass", () => {
    const err = new SovereignGuardError("bad_file");
    assert.ok(err instanceof Error);
  });

  test("has name 'SovereignGuardError'", () => {
    const err = new SovereignGuardError("bad_file");
    assert.equal(err.name, "SovereignGuardError");
  });

  test("message includes the filename", () => {
    const err = new SovereignGuardError("suspect_file.txt");
    assert.ok(err.message.includes("suspect_file.txt"));
  });

  test("message mentions VAULT_STORAGE_ROOT", () => {
    const err = new SovereignGuardError("x");
    assert.ok(err.message.includes(VAULT_STORAGE_ROOT));
  });
});

// ── resolveGuardedPath() ──────────────────────────────────────────────────────

describe("resolveGuardedPath()", () => {
  test("returns a path inside VAULT_STORAGE_ROOT for a simple filename", () => {
    const result = resolveGuardedPath("report.json");
    assert.ok(result.startsWith(VAULT_STORAGE_ROOT));
    assert.ok(result.endsWith("report.json"));
  });

  test("strips directory components (traversal safety)", () => {
    // path.basename("subdir/report.json") === "report.json"
    const result = resolveGuardedPath("subdir/report.json");
    assert.ok(result.startsWith(VAULT_STORAGE_ROOT));
    assert.ok(result.endsWith("report.json"));
    // No 'subdir' in the resolved path
    assert.ok(!result.includes("subdir"));
  });

  test("strips nested traversal sequences to a safe basename", () => {
    // path.basename("../../etc/passwd") === "passwd"
    const result = resolveGuardedPath("../../etc/passwd");
    assert.ok(result.startsWith(VAULT_STORAGE_ROOT));
    assert.ok(result.endsWith("passwd"));
  });

  test("throws SovereignGuardError for empty filename", () => {
    assert.throws(
      () => resolveGuardedPath(""),
      SovereignGuardError,
    );
  });

  test("throws SovereignGuardError for '.' filename", () => {
    assert.throws(
      () => resolveGuardedPath("."),
      SovereignGuardError,
    );
  });

  test("throws SovereignGuardError for '..' filename", () => {
    assert.throws(
      () => resolveGuardedPath(".."),
      SovereignGuardError,
    );
  });

  test("returns an absolute path", () => {
    const result = resolveGuardedPath("audit.log");
    assert.ok(path.isAbsolute(result));
  });
});

// ── guardedWrite() ────────────────────────────────────────────────────────────

describe("guardedWrite()", () => {
  test("writes a string file to vault_storage", () => {
    const testFilename = `guard-test-${Date.now()}.json`;
    guardedWrite(testFilename, JSON.stringify({ guarded: true }));
    const safePath = path.join(VAULT_STORAGE_ROOT, testFilename);
    assert.ok(fs.existsSync(safePath));
    const content = fs.readFileSync(safePath, "utf-8");
    assert.deepEqual(JSON.parse(content), { guarded: true });
    fs.rmSync(safePath);
  });

  test("writes a Buffer file to vault_storage", () => {
    const testFilename = `guard-buf-${Date.now()}.bin`;
    const buf = Buffer.from("sovereign guard test");
    guardedWrite(testFilename, buf);
    const safePath = path.join(VAULT_STORAGE_ROOT, testFilename);
    assert.ok(fs.existsSync(safePath));
    const content = fs.readFileSync(safePath);
    assert.deepEqual(content, buf);
    fs.rmSync(safePath);
  });

  test("creates vault_storage directory if it does not exist", () => {
    // vault_storage may not exist in a clean env — guardedWrite should create it
    const testFilename = `guard-mkdir-${Date.now()}.txt`;
    guardedWrite(testFilename, "mkdirp test");
    const safePath = path.join(VAULT_STORAGE_ROOT, testFilename);
    assert.ok(fs.existsSync(safePath));
    fs.rmSync(safePath);
  });

  test("throws SovereignGuardError for empty filename", () => {
    assert.throws(
      () => guardedWrite("", "data"),
      SovereignGuardError,
    );
  });

  test("throws SovereignGuardError for '.' filename", () => {
    assert.throws(
      () => guardedWrite(".", "data"),
      SovereignGuardError,
    );
  });
});
