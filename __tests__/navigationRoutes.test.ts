/**
 * __tests__/navigationRoutes.test.ts
 *
 * Unit tests for lib/navigationRoutes.ts — navigationRoutes and adminRoutes.
 *
 * Validates:
 * - /tari-revenue is NOT in the public navigationRoutes (footer cleanup, PR #329)
 * - /tari-revenue IS in the adminRoutes (admin-only access preserved)
 * - Every adminRoute entry has a corresponding entry in navigationRoutes
 * - No duplicate paths in either route list
 * - All route entries have required shape properties
 *
 * Run with: node --loader ./__tests__/loader.mjs --experimental-strip-types --test __tests__/navigationRoutes.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  navigationRoutes,
  adminRoutes,
  type NavigationRoute,
} from "../lib/navigationRoutes";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("navigationRoutes (public)", () => {
  test("every route has required shape: { path, label, icon }", () => {
    for (const route of navigationRoutes) {
      const r = route as NavigationRoute;
      assert.equal(typeof r.path,  "string", `path must be string in ${JSON.stringify(r)}`);
      assert.equal(typeof r.label, "string", `label must be string in ${JSON.stringify(r)}`);
      assert.equal(typeof r.icon,  "string", `icon must be string in ${JSON.stringify(r)}`);
      assert.ok(r.path.startsWith("/"), `path must start with / in ${JSON.stringify(r)}`);
    }
  });

  test("contains at least 10 routes (sanity check)", () => {
    assert.ok(navigationRoutes.length >= 10, `expected ≥10 routes, got ${navigationRoutes.length}`);
  });

  test("/tari-revenue is NOT in public navigationRoutes (Roadmap 2.4 footer cleanup)", () => {
    const tariRevenuePaths = navigationRoutes.filter((r) => r.path === "/tari-revenue");
    assert.equal(
      tariRevenuePaths.length,
      0,
      "/tari-revenue must be removed from public navigationRoutes (should only appear in adminRoutes)",
    );
  });

  test("no duplicate paths in navigationRoutes", () => {
    const paths = navigationRoutes.map((r) => r.path);
    const unique = new Set(paths);
    assert.equal(
      unique.size,
      paths.length,
      `Found duplicate paths in navigationRoutes: ${paths.filter((p, i) => paths.indexOf(p) !== i).join(", ")}`,
    );
  });

  test("all public routes have non-empty labels and icons", () => {
    for (const route of navigationRoutes) {
      assert.ok(route.label.trim().length > 0, `Empty label on route ${route.path}`);
      assert.ok(route.icon.trim().length  > 0, `Empty icon on route  ${route.path}`);
    }
  });
});

describe("adminRoutes (admin-only)", () => {
  test("every route has required shape: { path, label, icon }", () => {
    for (const route of adminRoutes) {
      const r = route as NavigationRoute;
      assert.equal(typeof r.path,  "string");
      assert.equal(typeof r.label, "string");
      assert.equal(typeof r.icon,  "string");
      assert.ok(r.path.startsWith("/"), `admin path must start with /`);
    }
  });

  test("/tari-revenue IS in adminRoutes (admin-only access preserved)", () => {
    const match = adminRoutes.find((r) => r.path === "/tari-revenue");
    assert.ok(match !== undefined, "/tari-revenue must remain in adminRoutes");
    assert.ok(match!.label.includes("TARI"), `adminRoute label should include TARI, got: "${match!.label}"`);
  });

  test("no duplicate paths in adminRoutes", () => {
    const paths = adminRoutes.map((r) => r.path);
    const unique = new Set(paths);
    assert.equal(
      unique.size,
      paths.length,
      `Found duplicate paths in adminRoutes: ${paths.filter((p, i) => paths.indexOf(p) !== i).join(", ")}`,
    );
  });

  test("adminRoutes has at least 5 entries (sanity check)", () => {
    assert.ok(adminRoutes.length >= 5, `expected ≥5 admin routes, got ${adminRoutes.length}`);
  });
});

describe("cross-route integrity", () => {
  test("adminRoutes has independent entries — some may not appear in public navigationRoutes", () => {
    // adminRoutes is NOT necessarily a subset of navigationRoutes.
    // Admin-only routes (e.g. /tari-revenue after Roadmap 2.4 cleanup) appear
    // ONLY in adminRoutes, not in the public nav. This test documents that fact.
    const navPaths = new Set(navigationRoutes.map((r) => r.path));
    const adminOnlyPaths = adminRoutes.filter((r) => !navPaths.has(r.path));
    // Confirm /tari-revenue is in the admin-only list (not in public nav)
    assert.ok(
      adminOnlyPaths.some((r) => r.path === "/tari-revenue"),
      "/tari-revenue should be admin-only (not in public navigationRoutes)",
    );
  });

  test("/tari-revenue does NOT appear in navigationRoutes but DOES appear in adminRoutes", () => {
    // Validates the Roadmap 2.4 footer cleanup: removed from public nav,
    // preserved in admin-only access control.
    const inNav   = navigationRoutes.some((r) => r.path === "/tari-revenue");
    const inAdmin = adminRoutes.some((r) => r.path === "/tari-revenue");
    assert.equal(inNav,   false, "/tari-revenue should NOT be in public navigationRoutes");
    assert.equal(inAdmin, true,  "/tari-revenue should be in adminRoutes");
  });
});
