/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * playwright.config.ts — AveryOS™ World-Class E2E Test Configuration
 *
 * Synergy merge of PR #419 + Phase 130.9 upgrade:
 * - PLAYWRIGHT_BASE_URL env var (PR #419 pattern — matches playwright-e2e.yml)
 * - outputFolder in tests/e2e/ (PR #419 — artifact upload path alignment)
 * - Multi-browser matrix (Chrome + Firefox + Mobile — Phase 130.9)
 * - webServer for local dev only (PR #419 pattern)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { defineConfig, devices } from "@playwright/test";

/** The base URL for the running server. Set via PLAYWRIGHT_BASE_URL in CI. */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.TEST_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "tests/e2e/playwright-report", open: "never" }],
    ["github"],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // Sovereign headers for all test requests
    extraHTTPHeaders: {
      "x-test-agent": "AveryOS-Playwright-Suite",
    },
  },
  projects: [
    // Desktop — Chrome (used in CI)
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    // Desktop — Firefox
    {
      name: "Desktop Firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    // Mobile — iPhone 14
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
  // webServer: only used for local dev (CI starts server manually in playwright-e2e.yml)
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
