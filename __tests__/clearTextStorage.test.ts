/**
 * __tests__/clearTextStorage.test.ts
 *
 * AveryOS™ Sovereign Security Test — CWE-312 / CWE-315 / CWE-359
 * CodeQL Rule: js/clear-text-storage-of-sensitive-data
 *
 * RCA AUTO-HEAL: Added after CodeQL alert #26 detected that
 * `app/admin/qa/page.tsx` stored the raw VAULTAUTH_TOKEN in sessionStorage.
 *
 * These tests perform a static scan of all admin TSX/TS files to ensure:
 *   1. No sessionStorage.setItem() stores a raw auth token/password.
 *   2. Admin pages use the HttpOnly cookie pattern (POST /api/v1/vault/auth)
 *      rather than storing secrets in browser-accessible storage.
 *   3. The hashPassphrase anti-pattern is absent (hashing before storing still
 *      violates best practice AND breaks server-side auth comparisons).
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROOT      = path.resolve(new URL(".", import.meta.url).pathname, "..");
const ADMIN_DIR = path.join(ROOT, "app", "admin");
const APP_DIR   = path.join(ROOT, "app");

/** Recursively find all .tsx / .ts files under a directory. */
function findFiles(dir: string, exts = [".tsx", ".ts"]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Return all lines in a file that match the given RegExp. */
function scanFile(filePath: string, pattern: RegExp): { line: number; text: string }[] {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  return lines
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => pattern.test(text));
}

// ── Patterns that must NOT appear in client-side files ────────────────────────

/**
 * Detects: sessionStorage.setItem("…TOKEN/token/password/auth/vault…", value)
 * The few allowed non-sensitive values ("true", "GRANTED", SESSION_KEY) are
 * excluded by checking for known safe patterns after the comma.
 */
const AUTH_STORAGE_WRITE = /sessionStorage\.setItem\s*\(\s*["'][^"']*(?:TOKEN|token|password|passphrase|vault|auth)[^"']*["']\s*,/i;

/**
 * The exact original CodeQL #26 pattern: storing a trimmed raw password.
 */
const RAW_PASSWORD_TRIM_STORAGE = /sessionStorage\.setItem\([^)]+(?:password|passphrase)\.trim\(\)/i;

/**
 * The broken "hash before store" anti-pattern introduced in c3d7ba8:
 * - Storing a derived token in sessionStorage still violates CWE-312.
 * - The hash also never matches the server's raw VAULT_PASSPHRASE.
 */
const HASH_BEFORE_STORE = /hashPassphrase|sessionStorage\.setItem[^)]+derivedToken/i;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CWE-312/315/359 — No cleartext auth token storage in browser (CodeQL #26)", () => {

  const adminFiles = findFiles(ADMIN_DIR);
  const appClientFiles = findFiles(APP_DIR).filter(f =>
    !f.includes("__tests__") &&
    !f.includes("/api/") &&
    !f.includes("node_modules")
  );

  test("admin pages must not write auth tokens to sessionStorage", () => {
    const violations: string[] = [];
    for (const file of adminFiles) {
      for (const h of scanFile(file, AUTH_STORAGE_WRITE)) {
        violations.push(`${path.relative(ROOT, file)}:${h.line}: ${h.text.trim()}`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `Cleartext auth token stored in sessionStorage (CWE-312/315):\n${violations.join("\n")}`
    );
  });

  test("no file stores a raw trimmed password in sessionStorage (exact CodeQL #26 pattern)", () => {
    const violations: string[] = [];
    for (const file of appClientFiles) {
      for (const h of scanFile(file, RAW_PASSWORD_TRIM_STORAGE)) {
        violations.push(`${path.relative(ROOT, file)}:${h.line}: ${h.text.trim()}`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `Raw password.trim() stored in sessionStorage:\n${violations.join("\n")}`
    );
  });

  test("hashPassphrase anti-pattern must not exist in admin pages (breaks server-side auth)", () => {
    const violations: string[] = [];
    for (const file of adminFiles) {
      for (const h of scanFile(file, HASH_BEFORE_STORE)) {
        violations.push(`${path.relative(ROOT, file)}:${h.line}: ${h.text.trim()}`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `hashPassphrase/derivedToken anti-pattern detected:\n${violations.join("\n")}`
    );
  });

  test("app/admin/qa/page.tsx uses credentials:same-origin and /api/v1/vault/auth", () => {
    const file = path.join(ADMIN_DIR, "qa", "page.tsx");
    const content = fs.readFileSync(file, "utf8");
    assert.ok(
      content.includes('credentials: "same-origin"'),
      "QA page must use credentials: 'same-origin' for API calls"
    );
    assert.ok(
      content.includes("/api/v1/vault/auth"),
      "QA page must POST to /api/v1/vault/auth for authentication"
    );
    assert.ok(
      !content.includes("sessionStorage.setItem"),
      "QA page must not call sessionStorage.setItem"
    );
  });

  test("app/admin/docs/page.tsx uses credentials:same-origin and /api/v1/vault/auth", () => {
    const file = path.join(ADMIN_DIR, "docs", "page.tsx");
    const content = fs.readFileSync(file, "utf8");
    assert.ok(
      content.includes('credentials: "same-origin"'),
      "Docs page must use credentials: 'same-origin' for API calls"
    );
    assert.ok(
      content.includes("/api/v1/vault/auth"),
      "Docs page must POST to /api/v1/vault/auth for authentication"
    );
    assert.ok(
      !content.includes("sessionStorage.setItem"),
      "Docs page must not call sessionStorage.setItem"
    );
  });

});

describe("RCA Audit — HttpOnly cookie auth infrastructure", () => {

  test("/api/v1/vault/auth route sets HttpOnly Secure SameSite=Strict cookie", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth", "route.ts");
    assert.ok(fs.existsSync(routePath), "/api/v1/vault/auth route must exist");
    const content = fs.readFileSync(routePath, "utf8");
    assert.ok(content.includes("HttpOnly"),       "vault auth route must set HttpOnly");
    assert.ok(content.includes("SameSite=Strict"),"vault auth route must set SameSite=Strict");
    assert.ok(content.includes("Set-Cookie"),      "vault auth route must emit Set-Cookie header");
  });

  test("VAULT_COOKIE_NAME comes from lib/vaultCookieConfig (single source of truth)", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth", "route.ts");
    const content = fs.readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("vaultCookieConfig"),
      "vault auth route must import VAULT_COOKIE_NAME from lib/vaultCookieConfig"
    );
  });

});
