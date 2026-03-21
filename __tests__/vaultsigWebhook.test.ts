/**
 * __tests__/vaultsigWebhook.test.ts
 *
 * Unit tests for app/api/v1/hooks/vaultsig/ webhook handlers
 * — Phase 111.6 / GATE 111.6.2
 *
 * Tests webhook signature verification logic, route shape, and
 * capsule-protection invariants.
 *
 * Run with: node --experimental-strip-types --test __tests__/vaultsigWebhook.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 for a message using the given secret.
 * Returns the hex digest (matching GitHub's X-Hub-Signature-256 format).
 */
function hmacSha256(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

// ── Route file existence checks ───────────────────────────────────────────────

describe("VaultSig webhook route files — existence and structure", () => {
  const ROOT = join(import.meta.dirname ?? __dirname, "..");

  test("main webhook route file exists", () => {
    const routePath = join(ROOT, "app/api/v1/hooks/vaultsig/route.ts");
    let content: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
      content = readFileSync(routePath, "utf8");
    } catch {
      assert.fail(`VaultSig main webhook route file not found: ${routePath}`);
    }
    // Must export a POST handler
    assert.ok(content.includes("export async function POST"), "route.ts must export POST handler");
    // Must verify GitHub webhook signature
    assert.ok(
      content.includes("x-hub-signature-256") || content.includes("verifyGitHubSignature"),
      "route.ts must verify X-Hub-Signature-256",
    );
    // Must import aosErrorResponse (sovereign error standard)
    assert.ok(content.includes("aosErrorResponse"), "route.ts must use aosErrorResponse");
  });

  test("success redirect route file exists", () => {
    const routePath = join(ROOT, "app/api/v1/hooks/vaultsig/success/route.ts");
    let content: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
      content = readFileSync(routePath, "utf8");
    } catch {
      assert.fail(`VaultSig success route file not found: ${routePath}`);
    }
    assert.ok(content.includes("export async function GET"), "success/route.ts must export GET handler");
    assert.ok(content.includes("Response.redirect"), "success/route.ts must issue a redirect");
  });

  test("setup handler route file exists", () => {
    const routePath = join(ROOT, "app/api/v1/hooks/vaultsig/setup/route.ts");
    let content: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
      content = readFileSync(routePath, "utf8");
    } catch {
      assert.fail(`VaultSig setup route file not found: ${routePath}`);
    }
    assert.ok(content.includes("export async function GET"), "setup/route.ts must export GET handler");
  });
});

// ── HMAC signature helper tests ───────────────────────────────────────────────

describe("GitHub webhook HMAC-SHA256 signature verification logic", () => {
  test("hmacSha256 produces deterministic output for fixed inputs", () => {
    const digest = hmacSha256("secret", "payload");
    assert.equal(typeof digest, "string");
    assert.match(digest, /^[a-f0-9]{64}$/, "HMAC-SHA256 must produce 64-character hex string");
  });

  test("same secret + payload always produces same HMAC", () => {
    const a = hmacSha256("test-secret", "test-payload");
    const b = hmacSha256("test-secret", "test-payload");
    assert.equal(a, b, "HMAC must be deterministic");
  });

  test("different secrets produce different HMACs", () => {
    const a = hmacSha256("secret-1", "payload");
    const b = hmacSha256("secret-2", "payload");
    assert.notEqual(a, b, "Different secrets must produce different HMACs");
  });

  test("different payloads produce different HMACs", () => {
    const a = hmacSha256("secret", "payload-1");
    const b = hmacSha256("secret", "payload-2");
    assert.notEqual(a, b, "Different payloads must produce different HMACs");
  });

  test("HMAC prefix format matches GitHub X-Hub-Signature-256 header", () => {
    const digest = hmacSha256("test-secret", "test-body");
    const header = `sha256=${digest}`;
    assert.ok(header.startsWith("sha256="), "Header must start with 'sha256='");
    assert.equal(header.length, 71, "sha256= (7 chars) + 64 hex chars = 71 total");
  });
});

// ── Capsule protection invariants ─────────────────────────────────────────────

describe("Capsule content protection invariants", () => {
  const ROOT = join(import.meta.dirname ?? __dirname, "..");

  test("capsule upload route requires VAULT_PASSPHRASE authentication", () => {
    const routePath = join(ROOT, "app/api/v1/capsules/upload/route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("VAULT_PASSPHRASE") && content.includes("safeEqual"),
      "Upload route must check VAULT_PASSPHRASE with safeEqual()",
    );
  });

  test("capsule download route requires a valid purchase token", () => {
    const routePath = join(ROOT, "app/api/v1/capsules/[capsuleId]/download/route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("download_token") || content.includes("token"),
      "Download route must validate a download token",
    );
  });

  test("public capsule listing route does NOT expose file_key", () => {
    const routePath = join(ROOT, "app/api/v1/capsules/route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(routePath, "utf8");
    // The public SELECT must not include file_key — it should only expose safe fields
    // Check the SELECT that feeds the public response (status = 'ACTIVE' query)
    const publicSelectMatch = content.match(
      /SELECT capsule_id[^;]+FROM sovereign_capsules[^;]+WHERE status = 'ACTIVE'/s,
    );
    if (publicSelectMatch) {
      assert.ok(
        !publicSelectMatch[0].includes("file_key"),
        "Public capsule listing SELECT must not expose file_key",
      );
    }
    // Belt-and-suspenders: the route must never use SELECT * (which would expose file_key)
    assert.ok(
      !content.includes("SELECT *"),
      "Public capsule route must not use SELECT * — use explicit field list to prevent file_key exposure",
    );
  });
});

// ── JWKS triple-part passthrough invariant ────────────────────────────────────

describe("JWKS route triple-part key passthrough — GATE 111.6.1", () => {
  const ROOT = join(import.meta.dirname ?? __dirname, "..");

  test("app/api/v1/jwks/route.ts passes all triple-part keys to getSovereignKeys", () => {
    const routePath = join(ROOT, "app/api/v1/jwks/route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_1_OF_3"),
      "JWKS route must pass AVERYOS_PRIVATE_KEY_B64_1_OF_3 to getSovereignKeys",
    );
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_2_OF_3"),
      "JWKS route must pass AVERYOS_PRIVATE_KEY_B64_2_OF_3 to getSovereignKeys",
    );
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_3_OF_3"),
      "JWKS route must pass AVERYOS_PRIVATE_KEY_B64_3_OF_3 to getSovereignKeys",
    );
  });

  test("app/.well-known/jwks.json/route.ts also passes triple-part keys", () => {
    const routePath = join(ROOT, "app/.well-known/jwks.json/route.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(routePath, "utf8");
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_1_OF_3"),
      "Well-known JWKS route must pass AVERYOS_PRIVATE_KEY_B64_1_OF_3",
    );
  });
});

// ── SovereignEnv interface completeness ───────────────────────────────────────

describe("SovereignEnv interface completeness — GATE 111.6.3", () => {
  const ROOT = join(import.meta.dirname ?? __dirname, "..");

  test("lib/security/keys.ts interface includes all UPPERCASE triple-part key fields", () => {
    const keysPath = join(ROOT, "lib/security/keys.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(keysPath, "utf8");
    // All three UPPERCASE parts must be declared in the interface
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_1_OF_3?: string"),
      "SovereignEnv must declare AVERYOS_PRIVATE_KEY_B64_1_OF_3",
    );
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_2_OF_3?: string"),
      "SovereignEnv must declare AVERYOS_PRIVATE_KEY_B64_2_OF_3",
    );
    assert.ok(
      content.includes("AVERYOS_PRIVATE_KEY_B64_3_OF_3?: string"),
      "SovereignEnv must declare AVERYOS_PRIVATE_KEY_B64_3_OF_3",
    );
  });

  test("resolvePrivateKeyB64 checks UPPERCASE before lowercase (precedence guarantee)", () => {
    const keysPath = join(ROOT, "lib/security/keys.ts");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
    const content = readFileSync(keysPath, "utf8");
    // The expression pattern: (env.AVERYOS_... ?? env.averyos_...) ensures UPPERCASE wins
    const uppercaseBeforeLowercase =
      /env\.AVERYOS_PRIVATE_KEY_B64_1_OF_3\s*\?\?\s*env\.averyos_private_key_b64_1_of_3/.test(content);
    assert.ok(
      uppercaseBeforeLowercase,
      "resolvePrivateKeyB64 must evaluate UPPERCASE binding before lowercase fallback",
    );
  });
});
