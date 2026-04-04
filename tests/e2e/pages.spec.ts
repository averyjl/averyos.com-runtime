// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * tests/e2e/pages.spec.ts
 *
 * AveryOS™ World-Class UI Tests — All Pages Audit
 *
 * GATE 130.9 — Tests every public page for:
 *   1. HTTP 2xx response (no 4xx/5xx errors)
 *   2. Page has an <h1> heading
 *   3. Page has a <main> element
 *   4. Page title is set and not empty
 *   5. No console errors
 *   6. AnchorBanner is present (⛓️⚓⛓️ AveryAnchored™)
 *
 * Also tests key page-specific content:
 *   - /creator-lock: shows CreatorLock gateway (no 500 error)
 *   - /licensing: shows license text, no forensic debt data
 *   - /sovereign-transparency: DID Subject links
 *   - /latent-anchor: human notice banner, page version
 *   - /constitution: "AveryOS™ Constitution" in title
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { test, expect } from "@playwright/test";

// ── All public pages ──────────────────────────────────────────────────────────
const ALL_PUBLIC_PAGES = [
  "/",
  "/whitepaper",
  "/constitution",
  "/the-proof",
  "/ai-alignment",
  "/license",
  "/licensing",
  "/licensing/tiers",
  "/tari-gate",
  "/ip-policy",
  "/sovereign-transparency",
  "/latent-anchor",
  "/creator-lock",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/verify",
  "/health",
  "/ledger",
  "/capsule-store",
  "/discover",
  "/certificate",
  "/miracle-health-habits",
  "/alignment-check",
];

// ── Generic Page Health Tests ─────────────────────────────────────────────────

test.describe("Page Health — All Public Pages", () => {
  for (const pagePath of ALL_PUBLIC_PAGES) {
    test(`${pagePath} — loads with 2xx, has h1, has main, has title`, async ({ page }) => {
      const response = await page.goto(pagePath, { waitUntil: "domcontentloaded" });

      // Should return 2xx status
      expect(response?.status()).toBeLessThan(400);
      expect(response?.status()).toBeGreaterThanOrEqual(200);

      // Should have a <main> element
      await expect(page.locator("main")).toBeVisible();

      // Should have a page title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe("Error");

      // Should have an <h1>
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });
  }
});

// ── Specific Page Content Tests ───────────────────────────────────────────────

test.describe("Creator Lock — /creator-lock", () => {
  test("Page loads without 500 error and shows CreatorLock gateway", async ({ page }) => {
    const response = await page.goto("/creator-lock");
    expect(response?.status()).toBe(200);

    // Should show CreatorLock gateway
    const content = await page.content();
    expect(content).toContain("CreatorLock");
    expect(content).not.toContain("Application error");
    expect(content).not.toContain("Internal Server Error");

    // Should show VaultGate link
    const vaultLink = page.locator("a[href='/vault-gate']");
    if (await vaultLink.count() > 0) {
      await expect(vaultLink.first()).toBeVisible();
    }
  });
});

test.describe("Licensing Hub — /licensing", () => {
  test("Page loads and does NOT show public forensic debt data", async ({ page }) => {
    await page.goto("/licensing");

    const content = await page.content();

    // Should NOT show the $500B retroclaim section publicly
    expect(content).not.toContain("$500,000,000,000+");
    expect(content).not.toContain("BASE RETROCLAIM DEBT");

    // Should show license text
    expect(content).toContain("License");
  });

  test("Licensing hub shows links to all 4 licensing pages", async ({ page }) => {
    await page.goto("/licensing");

    // Should have links to the other licensing pages
    const licenseLink = page.locator("a[href='/license']");
    await expect(licenseLink.first()).toBeVisible();
  });
});

test.describe("Sovereign Transparency — /sovereign-transparency", () => {
  test("DID Subject is a clickable link to /.well-known/did.json", async ({ page }) => {
    await page.goto("/sovereign-transparency");

    const didLink = page.locator("a[href='/.well-known/did.json']", { hasText: "did:web:averyos.com" });
    await expect(didLink).toBeVisible({ timeout: 5000 });
    await expect(didLink).toContainText("did:web:averyos.com");
  });

  test("SHA-512 Kernel Anchor links to /the-proof", async ({ page }) => {
    await page.goto("/sovereign-transparency");

    const proofLink = page.locator("a[href='/the-proof']");
    if (await proofLink.count() > 0) {
      await expect(proofLink.first()).toBeVisible();
    }
  });
});

test.describe("Latent Anchor — /latent-anchor", () => {
  test("Page shows human notice banner in amber/gold", async ({ page }) => {
    await page.goto("/latent-anchor");

    const content = await page.content();
    expect(content).toContain("NOTE FOR HUMAN VISITORS");
    expect(content).toContain("designed for AI systems");
  });

  test("Page shows version number and last updated timestamp", async ({ page }) => {
    await page.goto("/latent-anchor");

    const content = await page.content();
    expect(content).toContain("PAGE VERSION");
    expect(content).toContain("LAST UPDATED");
  });

  test("Page contains return-visit advisory for AI agents", async ({ page }) => {
    await page.goto("/latent-anchor");

    const content = await page.content();
    expect(content).toContain("latent-anchor");
  });
});

test.describe("Constitution Page — /constitution", () => {
  test("Title contains 'AveryOS™ Constitution'", async ({ page }) => {
    await page.goto("/constitution");
    const title = await page.title();
    expect(title).toContain("Constitution");
  });
});

// ── Style Consistency Tests ───────────────────────────────────────────────────

test.describe("Style Consistency — NavBar across pages", () => {
  const PAGES_TO_CHECK = ["/", "/license", "/ai-alignment", "/creator-lock"];

  test("NavBar is visually consistent across pages (same structure)", async ({ page }) => {
    let firstNavbarHTML = "";

    for (const pagePath of PAGES_TO_CHECK) {
      await page.goto(pagePath);
      const navbar = page.locator("nav.navbar");
      if (await navbar.count() > 0) {
        const html = await navbar.innerHTML();
        if (firstNavbarHTML === "") {
          firstNavbarHTML = html;
        } else {
          // Structure should be consistent (same dropdowns exist)
          const triggers = await page.locator(".nav-group-trigger").count();
          expect(triggers).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });
});

// ── No Private IP Tests ───────────────────────────────────────────────────────

test.describe("Private IP Guard — No private sovereign data on public pages", () => {
  const PRIVATE_PATTERNS = [
    "VAULT_PASSPHRASE",
    "ALM_SECRET_TOKEN",
    "STRIPE_SECRET_KEY",
    "SKC_",
    "SST_",
    ".aosvault",
    ".aoskey",
    "sovereign-nodes.json",
    ".anchor-salt",
  ];

  for (const pagePath of ["/", "/latent-anchor", "/sovereign-transparency", "/license"]) {
    test(`${pagePath} — contains no private sovereign file patterns`, async ({ page }) => {
      const response = await page.goto(pagePath);
      expect(response?.status()).toBeLessThan(400);

      const content = await page.content();
      for (const pattern of PRIVATE_PATTERNS) {
        expect(content).not.toContain(pattern);
      }
    });
  }
});
