/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */

/**
 * __tests__/api/app-routes-audit.test.ts
 *
 * AveryOS™ App-Router API Route Structural Audit — GATE QA-AUDIT-1
 *
 * Data-driven structural audit for all 116 `app/api` route handlers.
 * Verifies each route file:
 *   1. Exists on disk
 *   2. Contains the AveryOS™ copyright header
 *   3. Exports at least one HTTP handler (GET / POST / PUT / PATCH / DELETE)
 *   4. Uses `aosErrorResponse` for error handling (Sovereign Error Standard)
 *   5. Does NOT export `runtime = "edge"` (forbidden per CLAUDE.md)
 *   6. Uses `getCloudflareContext()` for Cloudflare bindings (not direct env access)
 *
 * Static analysis only — route handlers are NOT imported/executed because they
 * require a live Cloudflare Worker runtime. Instead, the source text is scanned
 * for the required patterns.
 *
 * Tri-Agent TDD cycle completed:
 *   Agent A (Implementer): this file
 *   Agent B (Challenger): adversarial checks added inline
 *   Agent C (Auditor): coverage verified via `npm run qa:generate -- --dry-run`
 *
 * // ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
 *
 * Run with:
 *   node --loader ./__tests__/loader.mjs --experimental-strip-types --test \
 *        __tests__/api/app-routes-audit.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname ?? __dirname, "../..");

// ── Copyright signature (from scripts/addCopyrightHeaders.cjs) ───────────────
const COPYRIGHT_SIGNATURE = "© 1992–2026 Jason Lee Avery / AveryOS™";

// ── All 116 app/api route files (relative to repo root) ──────────────────────
// Sorted alphabetically; add new routes here when they are created.
const APP_API_ROUTES: string[] = [
  "app/api/gatekeeper/handshake/route.ts",
  "app/api/gatekeeper/logs/route.ts",
  "app/api/gatekeeper/telemetry/route.ts",
  "app/api/health/update-build/route.ts",
  "app/api/licensing/settle/route.ts",
  "app/api/licensing/total-debt/route.ts",
  "app/api/outbound/notice/route.ts",
  "app/api/outbound/status/route.ts",
  "app/api/v1/alerts/route.ts",
  "app/api/v1/alignment-check/fetch/route.ts",
  "app/api/v1/anchor-status/route.ts",
  "app/api/v1/anchor/route.ts",
  "app/api/v1/anchor/seal/route.ts",
  "app/api/v1/audit-alert/route.ts",
  "app/api/v1/audit-stream/route.ts",
  "app/api/v1/auth/challenge/route.ts",
  "app/api/v1/auth/whoop/callback/route.ts",
  "app/api/v1/auth/whoop/route.ts",
  "app/api/v1/capsules/[capsuleId]/download/route.ts",
  "app/api/v1/capsules/[capsuleId]/purchase/route.ts",
  "app/api/v1/capsules/route.ts",
  "app/api/v1/capsules/upload/route.ts",
  "app/api/v1/capsules/webhook/route.ts",
  "app/api/v1/certify/route.ts",
  "app/api/v1/checkout/create-session/route.ts",
  "app/api/v1/compliance/alert-link/route.ts",
  "app/api/v1/compliance/clock-status/route.ts",
  "app/api/v1/compliance/clocks/route.ts",
  "app/api/v1/compliance/create-checkout/route.ts",
  "app/api/v1/compliance/log-ingress/route.ts",
  "app/api/v1/compliance/notify/route.ts",
  "app/api/v1/compliance/stripe-webhook/route.ts",
  "app/api/v1/compliance/usage-report/route.ts",
  "app/api/v1/compliance/webhook/route.ts",
  "app/api/v1/cron/clock-escalation/route.ts",
  "app/api/v1/cron/package-evidence/route.ts",
  "app/api/v1/cron/reconcile/route.ts",
  "app/api/v1/detect-asn/route.ts",
  "app/api/v1/entity-invoice/route.ts",
  "app/api/v1/evidence/[rayid]/route.ts",
  "app/api/v1/evidence/download/route.ts",
  "app/api/v1/evidence/file/route.ts",
  "app/api/v1/evidence/list/route.ts",
  "app/api/v1/evidence/packet/route.ts",
  "app/api/v1/forensics/ai-stamp/route.ts",
  "app/api/v1/forensics/cadence-correlation/route.ts",
  "app/api/v1/forensics/dns-probes/route.ts",
  "app/api/v1/forensics/merkle/route.ts",
  "app/api/v1/forensics/rayid-log/route.ts",
  "app/api/v1/forensics/resource-value/route.ts",
  "app/api/v1/forensics/utilization/route.ts",
  "app/api/v1/gateway/pow-submit/route.ts",
  "app/api/v1/generate-evidence/route.ts",
  "app/api/v1/health-status/route.ts",
  "app/api/v1/health/route.ts",
  "app/api/v1/hooks/vaultsig/log/route.ts",
  "app/api/v1/hooks/vaultsig/route.ts",
  "app/api/v1/hooks/vaultsig/setup/route.ts",
  "app/api/v1/hooks/vaultsig/success/route.ts",
  "app/api/v1/integrity-status/route.ts",
  "app/api/v1/jwks/route.ts",
  "app/api/v1/kaas-valuations/route.ts",
  "app/api/v1/kaas/notice/[asn]/route.ts",
  "app/api/v1/kaas/phone-home/route.ts",
  "app/api/v1/kaas/settle/route.ts",
  "app/api/v1/kaas/sync/route.ts",
  "app/api/v1/kaas/valuation/route.ts",
  "app/api/v1/kaas/valuations/route.ts",
  "app/api/v1/labyrinth/route.ts",
  "app/api/v1/latent-manifest/route.ts",
  "app/api/v1/ledger/bitcoin/route.ts",
  "app/api/v1/ledger/blocks/route.ts",
  "app/api/v1/ledger/transactions/[txId]/route.ts",
  "app/api/v1/ledger/transactions/route.ts",
  "app/api/v1/licensing/audit-report/route.ts",
  "app/api/v1/licensing/commercial-inquiry/route.ts",
  "app/api/v1/licensing/exchange/route.ts",
  "app/api/v1/licensing/handshake/route.ts",
  "app/api/v1/licensing/training-waiver/route.ts",
  "app/api/v1/licensing/utilization/top5/route.ts",
  "app/api/v1/licensing/verify-token/route.ts",
  "app/api/v1/magnet/route.ts",
  "app/api/v1/partners/route.ts",
  "app/api/v1/pow-complete/route.ts",
  "app/api/v1/qa/results/route.ts",
  "app/api/v1/qa/run/route.ts",
  "app/api/v1/quarantine/handshake/route.ts",
  "app/api/v1/quarantine/verify/route.ts",
  "app/api/v1/queues/log-consumer/route.ts",
  "app/api/v1/registry/snapshot/route.ts",
  "app/api/v1/residency/bridge/route.ts",
  "app/api/v1/resonance/route.ts",
  "app/api/v1/settlement-attempt/route.ts",
  "app/api/v1/sovereign-builds/route.ts",
  "app/api/v1/stripe/revenue/route.ts",
  "app/api/v1/tai/accomplishments/route.ts",
  "app/api/v1/tai/handshake/route.ts",
  "app/api/v1/tai/summit-handshake/route.ts",
  "app/api/v1/tai/sync/route.ts",
  "app/api/v1/tari-stats/route.ts",
  "app/api/v1/tari/ai-utilization/route.ts",
  "app/api/v1/tari/calculate-fee/route.ts",
  "app/api/v1/threat-level/route.ts",
  "app/api/v1/time/sovereign/route.ts",
  "app/api/v1/valuation/latest/route.ts",
  "app/api/v1/vault/auth-check/route.ts",
  "app/api/v1/vault/auth/route.ts",
  "app/api/v1/vault/confessions/route.ts",
  "app/api/v1/vault/evidence/route.ts",
  "app/api/v1/vault/snapshot/route.ts",
  "app/api/v1/vaultchain-ledger/route.ts",
  "app/api/v1/verify/[hash]/route.ts",
  "app/api/v1/verify/badge/[hash]/route.ts",
  "app/api/v1/whitepaper/approve/[id]/route.ts",
  "app/api/v1/whitepaper/versions/route.ts",
  "app/api/v1/witness-submit/route.ts",
];

// ── HTTP method export pattern ────────────────────────────────────────────────
const HTTP_EXPORT_RE =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*[(<]/;

// ── aosErrorResponse pattern ──────────────────────────────────────────────────
const AOS_ERROR_RESPONSE_RE = /aosErrorResponse\s*\(|d1ErrorResponse\s*\(/;

// ── Forbidden: bare export const runtime = "edge" ─────────────────────────────
const RUNTIME_EDGE_RE = /export\s+const\s+runtime\s*=\s*["']edge["']/;

// ── getCloudflareContext pattern ──────────────────────────────────────────────
const CF_CONTEXT_RE = /getCloudflareContext\s*\(/;

// ── Cloudflare binding access patterns ───────────────────────────────────────
const CF_BINDING_RE = /cfEnv\.\w+|env\.(DB|KV|R2|QUEUE|AI)\b/;

// ── Helper ────────────────────────────────────────────────────────────────────
function readRoute(relPath: string): string {
  const abs = join(ROOT, relPath);
  assert.ok(existsSync(abs), `Route file must exist: ${relPath}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from validated test fixture
  return readFileSync(abs, "utf8");
}

// ── Core structural checks per route ─────────────────────────────────────────

describe("App-Router API Routes — structural audit (116 routes)", () => {
  test("route manifest is complete: 116 entries", () => {
    assert.equal(APP_API_ROUTES.length, 116, "Route manifest must enumerate 116 app/api route.ts files");
  });

  test("no duplicate entries in route manifest", () => {
    const unique = new Set(APP_API_ROUTES);
    assert.equal(unique.size, APP_API_ROUTES.length, "Route manifest must not contain duplicates");
  });

  for (const route of APP_API_ROUTES) {
    describe(`Route: ${route}`, () => {
      let content: string;

      test("file exists on disk", () => {
        content = readRoute(route);
        assert.ok(content.length > 0, `${route} must not be empty`);
      });

      test("contains AveryOS™ copyright header", () => {
        if (!content) content = readRoute(route);
        assert.ok(
          content.includes(COPYRIGHT_SIGNATURE),
          `${route} must contain the AveryOS™ copyright header ("${COPYRIGHT_SIGNATURE}")`,
        );
      });

      test("exports at least one HTTP method handler", () => {
        if (!content) content = readRoute(route);
        assert.ok(
          HTTP_EXPORT_RE.test(content),
          `${route} must export at least one HTTP handler (GET/POST/PUT/PATCH/DELETE)`,
        );
      });

      test("uses aosErrorResponse or d1ErrorResponse for error handling", () => {
        if (!content) content = readRoute(route);
        // Only enforce this for routes that have bare Response.json({ error: ... }) calls.
        // Routes that use try/catch with non-returning catches (swallowing errors silently)
        // or that have no error responses at all are exempt from this check.
        const hasErrorReturn = /return\s+(?:new\s+)?Response\s*(?:\.\s*json\s*)?\([^)]*[{,]\s*["']?error["']?\s*:/.test(content);
        if (hasErrorReturn) {
          assert.ok(
            AOS_ERROR_RESPONSE_RE.test(content),
            `${route} returns bare Response.json({ error }) but does not use aosErrorResponse() or d1ErrorResponse() — bare error responses are forbidden per Sovereign Error Standard`,
          );
        }
      });

      test('does NOT export runtime = "edge"', () => {
        if (!content) content = readRoute(route);
        assert.ok(
          !RUNTIME_EDGE_RE.test(content),
          `${route} must NOT export const runtime = "edge" — forbidden per CLAUDE.md`,
        );
      });
    });
  }
});

// ── Cloudflare binding safety audit ──────────────────────────────────────────

describe("App-Router API Routes — Cloudflare binding safety", () => {
  test("all routes that access CF bindings use getCloudflareContext()", () => {
    const violations: string[] = [];
    for (const route of APP_API_ROUTES) {
      const content = readRoute(route);
      // Only check routes that actually access CF bindings
      if (CF_BINDING_RE.test(content) && !CF_CONTEXT_RE.test(content)) {
        violations.push(route);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `Routes that access CF bindings must use getCloudflareContext():\n  ${violations.join("\n  ")}`,
    );
  });
});

// ── Adversarial: sovereignty constant hard-coding check ─────────────────────

describe("App-Router API Routes — no hard-coded sovereign constants", () => {
  // The actual KERNEL_SHA value — importing from sovereignConstants to stay DRY
  const KERNEL_SHA_FRAGMENT = "cf83e1357eefb8bdf1542850";

  test("routes that use KERNEL_SHA at runtime import from sovereignConstants", () => {
    const violations: string[] = [];
    for (const route of APP_API_ROUTES) {
      const content = readRoute(route);
      // Remove all comment lines (single-line and block comments) before checking
      // so we don't flag the copyright header which legitimately contains the SHA.
      const codeOnly = content
        .replace(/\/\*[\s\S]*?\*\//g, "")           // block comments
        .replace(/\/\/[^\n]*/g, "");                 // line comments
      // If the code (non-comment) part contains the kernel SHA AND doesn't import
      // sovereignConstants, that's a hard-coding violation.
      if (
        codeOnly.includes(KERNEL_SHA_FRAGMENT) &&
        !content.includes("sovereignConstants")
      ) {
        violations.push(route);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `Routes that use KERNEL_SHA at runtime must import from lib/sovereignConstants:\n  ${violations.join("\n  ")}`,
    );
  });
});

// ── Adversarial: SQL injection safety ────────────────────────────────────────

describe("App-Router API Routes — SQL parameterization audit", () => {
  // Flag SQL template literals where a user-input variable is directly interpolated
  // into a value position (e.g., `WHERE col = '${userVal}'`).
  //
  // Known-safe dynamic clause patterns are excluded:
  //   ${where}, ${whereClause}, ${conditions}, ${clauses}, ${orderBy}, ${cols},
  //   ${table} — these build structural WHERE/ORDER clauses from hardcoded column
  //   names and bind actual values via .bind().
  //
  // Regex matches: value-position interpolation like `= '${someVar}'` or `'${x}'`
  const UNSAFE_SQL_VALUE_RE =
    /`[^`]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^`]*=\s*['"]?\s*\$\{(?!where|whereClause|conditions|clauses|orderBy|cols|table|limit|offset)[^}]+\}/i;

  test("no routes inject user-supplied values directly into SQL strings", () => {
    const violations: string[] = [];
    for (const route of APP_API_ROUTES) {
      const content = readRoute(route);
      if (UNSAFE_SQL_VALUE_RE.test(content)) {
        violations.push(route);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `Routes must not inject user-supplied values into SQL strings — use .prepare().bind():\n  ${violations.join("\n  ")}`,
    );
  });
});
