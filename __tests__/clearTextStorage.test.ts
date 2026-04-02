/**
 * __tests__/clearTextStorage.test.ts
 *
 * AveryOS™ Sovereign Security Tests — permanent CI regression guard.
 *
 * Covers:
 *   A. CWE-312/315/359 — No cleartext auth token storage in browser (CodeQL #26)
 *   B. useVaultAuth hook — dynamic auth pattern (all admin pages use it)
 *   C. /api/v1/vault/auth-check — dedicated cookie-validation endpoint
 *   D. JSDoc @returns Promise mismatch scan — prevents stale async annotations
 *
 * RCA AUTO-HEAL: Added after CodeQL alert #26 detected that
 * `app/admin/qa/page.tsx` stored the raw VAULTAUTH_TOKEN in sessionStorage.
 * Extended after code-review feedback recommended a dedicated auth-check
 * endpoint instead of probing real data APIs to detect cookies.
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
const LIB_DIR   = path.join(ROOT, "lib");

/** Recursively find all .tsx / .ts files under a directory. */
function findFiles(dir: string, exts = [".tsx", ".ts"]): string[] {
  const results: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
  if (!fs.existsSync(dir)) return results;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
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
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  return lines
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => pattern.test(text));
}

// ── Patterns that must NOT appear in client-side files ────────────────────────

/**
 * Detects: sessionStorage.setItem("…TOKEN/token/password/auth/vault…", value)
 */
const AUTH_STORAGE_WRITE = /sessionStorage\.setItem\s*\(\s*["'][^"']*(?:TOKEN|token|password|passphrase|vault|auth)[^"']*["']\s*,/i;

/** The exact original CodeQL #26 pattern: storing a trimmed raw password. */
const RAW_PASSWORD_TRIM_STORAGE = /sessionStorage\.setItem\([^)]+(?:password|passphrase)\.trim\(\)/i;

/**
 * The broken "hash before store" anti-pattern introduced in c3d7ba8:
 * hashing still violates CWE-312 AND breaks server-side auth comparisons.
 */
const HASH_BEFORE_STORE = /hashPassphrase|sessionStorage\.setItem[^)]+derivedToken/i;

// ── Section A: CWE-312/315/359 ────────────────────────────────────────────────

describe("A — CWE-312/315/359: No cleartext auth token storage in browser (CodeQL #26)", () => {

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

});

// ── Section B: useVaultAuth hook — dynamic auth pattern ───────────────────────

describe("B — useVaultAuth hook: all admin pages use the permanent auth pattern", () => {

  const HOOK_IMPORT = "useVaultAuth";

  /**
   * All admin page.tsx files must import useVaultAuth.
   * Add new pages here as they are created.
   */
  const ADMIN_PAGES = [
    path.join(ADMIN_DIR, "qa",                 "page.tsx"),
    path.join(ADMIN_DIR, "docs",               "page.tsx"),
    path.join(ADMIN_DIR, "forensics",          "page.tsx"),
    path.join(ADMIN_DIR, "settlements",        "page.tsx"),
    path.join(ADMIN_DIR, "monetization",       "page.tsx"),
    path.join(ADMIN_DIR, "tai-accomplishments","page.tsx"),
    path.join(ADMIN_DIR, "health-status",      "page.tsx"),
  ];

  for (const pagePath of ADMIN_PAGES) {
    const label = path.relative(ROOT, pagePath);
    test(`${label} — imports and uses useVaultAuth`, () => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
      assert.ok(fs.existsSync(pagePath), `${label} must exist`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
      const content = fs.readFileSync(pagePath, "utf8");
      assert.ok(
        content.includes(HOOK_IMPORT),
        `${label} must import useVaultAuth from lib/hooks/useVaultAuth`
      );
      assert.ok(
        !content.includes("sessionStorage.setItem"),
        `${label} must not call sessionStorage.setItem`
      );
    });
  }

  test("useVaultAuth hook file exists at lib/hooks/useVaultAuth.ts", () => {
    const hookPath = path.join(LIB_DIR, "hooks", "useVaultAuth.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    assert.ok(fs.existsSync(hookPath), "lib/hooks/useVaultAuth.ts must exist");
  });

  test("useVaultAuth hook probes /api/v1/vault/auth-check (not a data API)", () => {
    const hookPath = path.join(LIB_DIR, "hooks", "useVaultAuth.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content  = fs.readFileSync(hookPath, "utf8");
    assert.ok(
      content.includes("/api/v1/vault/auth-check"),
      "useVaultAuth must probe /api/v1/vault/auth-check on mount"
    );
    // Must NOT probe a real data API as a side-effect of auth checking.
    const dataProbePatterns = [
      /\/api\/v1\/qa\/results/,
      /\/api\/v1\/forensics/,
      /\/api\/v1\/kaas\/valuations/,
      /\/api\/v1\/stripe\/revenue/,
      /\/api\/v1\/tai\/accomplishments/,
    ];
    for (const pattern of dataProbePatterns) {
      assert.ok(
        !pattern.test(content),
        `useVaultAuth must not probe a data API (found: ${pattern})`
      );
    }
  });

  test("useVaultAuth hook POSTs to /api/v1/vault/auth for login", () => {
    const hookPath = path.join(LIB_DIR, "hooks", "useVaultAuth.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content  = fs.readFileSync(hookPath, "utf8");
    assert.ok(
      content.includes("/api/v1/vault/auth"),
      "useVaultAuth must POST to /api/v1/vault/auth for login"
    );
    assert.ok(
      content.includes('credentials: "same-origin"'),
      "useVaultAuth must use credentials: same-origin"
    );
  });

});

// ── Section C: /api/v1/vault/auth-check endpoint ─────────────────────────────

describe("C — /api/v1/vault/auth-check: dedicated cookie-validation endpoint", () => {

  test("/api/v1/vault/auth-check route exists", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth-check", "route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    assert.ok(fs.existsSync(routePath), "/api/v1/vault/auth-check/route.ts must exist");
  });

  test("/api/v1/vault/auth-check uses safeEqual for constant-time comparison", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth-check", "route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content   = fs.readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("safeEqual"),
      "auth-check route must use safeEqual() for constant-time cookie validation"
    );
  });

  test("/api/v1/vault/auth-check reads VAULT_COOKIE_NAME from lib/vaultCookieConfig", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth-check", "route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content   = fs.readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("vaultCookieConfig"),
      "auth-check route must import VAULT_COOKIE_NAME from lib/vaultCookieConfig"
    );
  });

  test("/api/v1/vault/auth route still sets HttpOnly Secure SameSite=Strict cookie", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth", "route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    assert.ok(fs.existsSync(routePath), "/api/v1/vault/auth route must exist");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = fs.readFileSync(routePath, "utf8");
    assert.ok(content.includes("HttpOnly"),        "vault auth route must set HttpOnly");
    assert.ok(content.includes("SameSite=Strict"), "vault auth route must set SameSite=Strict");
    assert.ok(content.includes("Set-Cookie"),      "vault auth route must emit Set-Cookie header");
  });

  test("VAULT_COOKIE_NAME comes from lib/vaultCookieConfig (single source of truth)", () => {
    const routePath = path.join(ROOT, "app", "api", "v1", "vault", "auth", "route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content   = fs.readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("vaultCookieConfig"),
      "vault auth route must import VAULT_COOKIE_NAME from lib/vaultCookieConfig"
    );
  });

});

// ── Section D: JSDoc @returns Promise mismatch scan ──────────────────────────
//
// Prevents stale `@returns Promise<T>` annotations on functions that were
// changed from async to synchronous (the code-review finding for clockEngine.ts).
// Scans all lib/ and app/api/ TypeScript files.

describe("D — JSDoc @returns Promise mismatch scan (stale async annotations)", () => {

  /**
   * Find functions that have a `@returns Promise` JSDoc annotation but
   * whose signature is NOT async and does NOT declare `: Promise<`.
   *
   * Returns any violations found.
   */
  function findReturnsMismatch(filePath: string): { line: number; text: string }[] {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const src   = fs.readFileSync(filePath, "utf8");
    const lines = src.split("\n");
    const violations: { line: number; text: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- bounded loop index
      const line = lines[i] ?? "";
      // Look for a JSDoc @returns line that mentions Promise
      if (!/@returns?\s+.*Promise/i.test(line)) continue;

      // Scan forward (up to 10 lines) for the function signature
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        // eslint-disable-next-line security/detect-object-injection -- bounded loop index
        const sigLine = lines[j] ?? "";
        // Skip JSDoc continuation lines and blank lines
        if (/^\s*\*/.test(sigLine) || sigLine.trim() === "") continue;
        // If this line is a function/export/const declaration...
        if (/\b(function|async function|const|export)\b/.test(sigLine)) {
          const isAsync    = /\basync\b/.test(sigLine);
          const hasPromise = /:\s*Promise</.test(sigLine) || /Promise</.test(sigLine);
          if (!isAsync && !hasPromise) {
            violations.push({
              line: j + 1,
              text: `@returns Promise annotation but sync function: ${sigLine.trim()}`,
            });
          }
          break;
        }
      }
    }
    return violations;
  }

  const libFiles    = findFiles(LIB_DIR);
  const apiFiles    = findFiles(path.join(APP_DIR, "api"));
  const targetFiles = [...libFiles, ...apiFiles].filter(f => !f.includes("node_modules"));

  test("no lib/ or app/api/ file has @returns Promise on a synchronous function", () => {
    const allViolations: string[] = [];
    for (const file of targetFiles) {
      for (const v of findReturnsMismatch(file)) {
        allViolations.push(`${path.relative(ROOT, file)}:${v.line}: ${v.text}`);
      }
    }
    assert.deepEqual(
      allViolations,
      [],
      `Stale @returns Promise annotation on sync function:\n${allViolations.join("\n")}`
    );
  });

});

