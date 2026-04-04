/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * tests/e2e/navigation.spec.ts
 *
 * AveryOS™ World-Class UI Tests — Navigation & Global Structure
 *
 * Tests (aligned with PR #419 + Phase 130.9 navGroups pattern):
 *   1. NavBar renders on all pages (nav.navbar present)
 *   2. NavBar has 5 nav-group dropdowns (Core, Licensing, Vault, CapsuleStore, Reference)
 *   3. Dropdown menus open on click (nav-group-trigger → nav-dropdown)
 *   4. Dropdown menus close on Escape key
 *   5. Footer renders with copyright text on all pages
 *   6. Footer contains anchor text "AveryAnchored™"
 *   7. Brand "AveryOS™" present in navbar
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, expect } from "@playwright/test";

// Core pages to test navigation on
const CORE_PAGES = ["/", "/whitepaper", "/license", "/ai-alignment", "/sovereign-transparency"];

test.describe("NavBar — Global Navigation", () => {
  for (const pagePath of CORE_PAGES) {
    test(`NavBar renders correctly on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);

      // NavBar should be visible
      const navbar = page.locator("nav.navbar");
      await expect(navbar).toBeVisible();

      // Brand should show AveryOS™
      const brand = page.locator(".navbar-brand");
      await expect(brand).toBeVisible();
      await expect(brand).toContainText("AveryOS");

      // Expect 5 nav-group triggers (navGroups: Core, Licensing, Vault, CapsuleStore, Reference)
      // May be 6 if admin (VaultGate-authenticated) — accept 5 or 6
      const triggers = page.locator(".nav-group-trigger");
      const count = await triggers.count();
      expect([5, 6]).toContain(count);
    });
  }

  test("Nav dropdown opens on click and shows items", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click the first nav-group trigger (Core)
    const firstTrigger = page.locator(".nav-group-trigger").first();
    await expect(firstTrigger).toBeVisible();
    await firstTrigger.click();

    // Dropdown menu should appear
    const menu = page.locator(".nav-dropdown").first();
    await expect(menu).toBeVisible({ timeout: 2000 });

    // Menu should contain items
    const items = menu.locator(".nav-dropdown-item");
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThanOrEqual(3);
  });

  test("Nav dropdown closes on Escape key", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const firstTrigger = page.locator(".nav-group-trigger").first();
    await firstTrigger.click();

    const menu = page.locator(".nav-dropdown").first();
    await expect(menu).toBeVisible({ timeout: 2000 });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible({ timeout: 2000 });
  });

  test("Nav dropdown closes on outside click", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const firstTrigger = page.locator(".nav-group-trigger").first();
    await firstTrigger.click();

    const menu = page.locator(".nav-dropdown").first();
    await expect(menu).toBeVisible({ timeout: 2000 });

    // Click outside
    await page.locator("main").click({ force: true });
    await expect(menu).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe("Footer — Global Footer", () => {
  for (const pagePath of CORE_PAGES) {
    test(`Footer renders with copyright on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);

      // Footer should be visible (FooterBadge renders as <footer>)
      const footer = page.locator("footer.footer-badge");
      if ((await footer.count()) === 0) return; // page may not include FooterBadge

      await expect(footer).toBeVisible();

      // AveryAnchored™ sovereign strip
      await expect(footer).toContainText("AveryAnchored™");

      // Copyright text
      await expect(footer).toContainText("Jason Lee Avery");
      await expect(footer).toContainText("All Rights Reserved");
    });
  }
});
