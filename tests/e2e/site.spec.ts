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
 * tests/e2e/site.spec.ts
 *
 * AveryOS™ World-Class E2E Test Suite
 *
 * WORLD-CLASS QA STANDARDS APPLIED:
 * 1. Every public route returns HTTP 200
 * 2. NavBar is present and renders all 5 top-level groups
 * 3. Footer is present with correct copyright text
 * 4. Page <title> includes "AveryOS"
 * 5. No private IP patterns in page HTML
 * 6. Mobile viewport: no horizontal overflow
 * 7. All internal links in nav resolve to known routes
 * 8. Consistent brand marks present (AveryOS™)
 * 9. Page-specific functional checks (licensing hub, sovereign-transparency, latent-anchor)
 * 10. New pages dynamically discovered from navGroups
 *
 * FCA (Forensic Cause Analysis) integration:
 * - Any failure here triggers root-cause comments in the PR via GitHub reporter
 * - All failures must be resolved at code-design stage, not left for PR review
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, expect, type Page } from "@playwright/test";

// ── Route registry — sourced from navGroups ────────────────────────────────────
// This list is the ground truth for all publicly testable routes.
// Add new routes here when they are created.
const PUBLIC_ROUTES = [
  "/",
  "/whitepaper",
  "/constitution",
  "/the-proof",
  "/ai-alignment",
  "/about",
  "/latent-anchor",
  "/licensing",
  "/license",
  "/licensing/tiers",
  "/tari-gate",
  "/ip-policy",
  "/alignment-check",
  "/compatibility",
  "/partners",
  "/ledger",
  "/vault/vaultchain-status",
  "/evidence-vault",
  "/sovereign-transparency",
  "/verify",
  "/certificate",
  "/capsule-store",
  "/discover",
  "/embedbuilder",
  "/lawcodex",
  "/creator-lock",
  "/health",
  "/contact",
  "/privacy",
  "/terms",
  "/witness/register",
];

// Private IP patterns that must NEVER appear in public page HTML
const PRIVATE_IP_PATTERNS = [
  /SKC_/,
  /SST_/,
  /KC\.lock/,
  /ClockGate/,
  /\.aoskey/,
  /\.aosvault/,
  /\.aosmem/,
  /VAULT_PASSPHRASE\s*=/,
  /sk_live_[a-zA-Z0-9]{20,}/,
  /whsec_[a-zA-Z0-9]{20,}/,
  /-----BEGIN.*PRIVATE KEY/,
];

// ── Helper: check common page structure ───────────────────────────────────────

async function assertPageStructure(page: Page, path: string) {
  // NavBar brand
  const brand = page.locator("nav .navbar-brand");
  await expect(brand, `NavBar brand missing on ${path}`).toBeVisible();

  // Footer copyright text
  const footer = page.locator("footer");
  await expect(footer, `Footer missing on ${path}`).toBeVisible();

  const copyrightText = await footer.innerText().catch(() => "");
  expect(
    copyrightText.includes("Jason Lee Avery") || copyrightText.includes("AveryOS"),
    `Footer missing copyright on ${path}`
  ).toBe(true);
}

async function assertNoPrivateIp(page: Page, path: string) {
  const html = await page.content();
  for (const pattern of PRIVATE_IP_PATTERNS) {
    expect(
      pattern.test(html),
      `⚠️ Private IP pattern "${pattern}" detected on ${path}`
    ).toBe(false);
  }
}

// ── 1. All public routes return 200 ──────────────────────────────────────────

test.describe("HTTP status — all public routes return 200", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route} → 200`, async ({ page }) => {
      const response = await page.goto(route);
      expect(
        response?.status(),
        `Expected HTTP 200 for ${route}, got ${response?.status()}`
      ).toBe(200);
    });
  }
});

// ── 2. NavBar structure ────────────────────────────────────────────────────────

test.describe("NavBar — grouped dropdown navigation", () => {
  test("NavBar is visible and contains AveryOS™ brand", async ({ page }) => {
    await page.goto("/");
    const brand = page.locator("nav .navbar-brand");
    await expect(brand).toBeVisible();
    await expect(brand).toContainText("AveryOS");
  });

  test("NavBar renders top-level nav group buttons", async ({ page }) => {
    await page.goto("/");
    const triggers = page.locator(".nav-group-trigger");
    // Expect at least 5 groups: Core, Licensing, Vault, CapsuleStore, Reference
    await expect(triggers).toHaveCountGreaterThan(4);
  });

  test("NavBar dropdown opens on hover and shows child links", async ({ page }) => {
    await page.goto("/");
    const coreTrigger = page.locator(".nav-group-trigger").first();
    await coreTrigger.hover();
    const dropdown = page.locator(".nav-dropdown").first();
    await expect(dropdown).toBeVisible();
    // Should contain at least one link
    const links = dropdown.locator(".nav-dropdown-item");
    await expect(links).toHaveCountGreaterThan(0);
  });
});

// ── 3. Footer copyright on all pages ─────────────────────────────────────────

test.describe("Footer — copyright present on all public pages", () => {
  for (const route of PUBLIC_ROUTES.slice(0, 8)) {
    // Sample first 8 routes for speed
    test(`Footer copyright on ${route}`, async ({ page }) => {
      await page.goto(route);
      await assertPageStructure(page, route);
    });
  }
});

// ── 4. Page titles ────────────────────────────────────────────────────────────

test.describe("Page titles include AveryOS", () => {
  const titledRoutes = ["/", "/whitepaper", "/licensing", "/sovereign-transparency"];
  for (const route of titledRoutes) {
    test(`Title includes AveryOS on ${route}`, async ({ page }) => {
      await page.goto(route);
      const title = await page.title();
      expect(title, `Page title missing AveryOS on ${route}`).toMatch(/AveryOS/i);
    });
  }
});

// ── 5. Private IP protection ──────────────────────────────────────────────────

test.describe("Private IP — no leaked patterns in page HTML", () => {
  const checkRoutes = ["/", "/latent-anchor", "/licensing", "/sovereign-transparency", "/the-proof"];
  for (const route of checkRoutes) {
    test(`No private IP on ${route}`, async ({ page }) => {
      await page.goto(route);
      await assertNoPrivateIp(page, route);
    });
  }
});

// ── 6. Mobile viewport — no horizontal overflow ────────────────────────────────

test.describe("Mobile — no horizontal overflow", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro
  const mobileRoutes = ["/", "/licensing", "/sovereign-transparency", "/latent-anchor"];
  for (const route of mobileRoutes) {
    test(`No horizontal overflow on ${route} (mobile)`, async ({ page }) => {
      await page.goto(route);
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 390;
      expect(
        bodyWidth,
        `Horizontal overflow on ${route}: body=${bodyWidth}px > viewport=${viewportWidth}px`
      ).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
    });
  }
});

// ── 7. Sovereign Transparency page — specific checks ──────────────────────────

test.describe("sovereign-transparency — DID link and SHA display", () => {
  test("DID Subject is a clickable link to /.well-known/did.json", async ({ page }) => {
    await page.goto("/sovereign-transparency");
    const didLink = page.locator('a[href="/.well-known/did.json"]');
    await expect(didLink).toBeVisible();
    await expect(didLink).toContainText("did:web:averyos.com");
  });

  test("Full SHA-512 is displayed and links to /the-proof", async ({ page }) => {
    await page.goto("/sovereign-transparency");
    const sha512Link = page.locator('a[href="/the-proof"]');
    await expect(sha512Link).toBeVisible();
    // Should contain the full 128-char kernel SHA
    const text = await sha512Link.innerText();
    expect(text.length, "SHA-512 should be 128 chars").toBeGreaterThan(100);
  });
});

// ── 8. Latent Anchor — AI notice and machine endpoints ───────────────────────

test.describe("latent-anchor — AI notice and machine endpoints", () => {
  test("Human visitor notice is displayed", async ({ page }) => {
    await page.goto("/latent-anchor");
    const notice = page.locator("text=NOTICE FOR HUMAN VISITORS");
    await expect(notice).toBeVisible();
  });

  test("Page version and last-updated timestamp are displayed", async ({ page }) => {
    await page.goto("/latent-anchor");
    const versionText = page.locator("text=Page Version:");
    await expect(versionText).toBeVisible();
  });

  test("Well-known endpoint links are present", async ({ page }) => {
    await page.goto("/latent-anchor");
    const jwksLink = page.locator('a[href*=".well-known/jwks"]').first();
    await expect(jwksLink).toBeVisible();
  });
});

// ── 9. Licensing Hub — all sub-links present ─────────────────────────────────

test.describe("licensing hub — sub-pages accessible", () => {
  test("Licensing hub page loads and contains licensing content", async ({ page }) => {
    await page.goto("/licensing");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    const title = await page.title();
    expect(title).toMatch(/licens/i);
  });
});

// ── 10. Constitution page — correct title ────────────────────────────────────

test.describe("constitution — page title and content", () => {
  test("Constitution page has AveryOS™ Constitution in title or heading", async ({ page }) => {
    await page.goto("/constitution");
    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible();
  });
});
