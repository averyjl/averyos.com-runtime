// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * playwright.config.ts
 *
 * AveryOS™ World-Class UI Test Configuration
 *
 * GATE 130.9 — Playwright e2e test suite for all AveryOS™ pages.
 *
 * Standards:
 *   - Tests all public pages for 200/2xx response codes
 *   - Validates NavBar, Footer, and AnchorBanner consistency across pages
 *   - Checks page structure (h1, main, footer present)
 *   - Validates no 4xx/5xx errors on navigation
 *   - Checks mobile and desktop viewport behavior
 *   - Validates copyright is present in footer
 *   - Tests key page content and links
 *   - CI integration via GitHub Actions
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["github"],
    ["list"],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Sovereign headers for all test requests
    extraHTTPHeaders: {
      "x-test-agent": "AveryOS-Playwright-Suite",
    },
  },
  projects: [
    // Desktop — Chrome
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    // Desktop — Firefox
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    // Mobile — iPhone 13
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
    // Mobile — Android
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  // webServer config for local dev testing
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
