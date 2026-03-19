#!/usr/bin/env node
/**
 * scripts/avery-qa.cjs
 *
 * AveryOS™ Sovereign QA Engine — Phase 112 / GATE 111.2.2
 *
 * World-class QA framework for the AveryOS™ runtime. Runs a suite of
 * checks from three perspectives:
 *
 *   HUMAN_USER       — checks that a legitimate user would experience correctly
 *   BOT_AGENT        — checks from an autonomous-agent / API consumer angle
 *   TAI_PERSPECTIVE  — checks from the AveryOS™ Truth Anchored Intelligence view
 *
 * Each check is assigned a severity:
 *   CRITICAL — failure blocks deployment / signals kernel drift
 *   HIGH     — failure needs immediate attention
 *   MEDIUM   — warning; degrades experience
 *   LOW      — informational
 *
 * Results are:
 *   1. Printed to stdout with colour-coded output.
 *   2. Written to __tests__/generated/qa-run-<timestamp>.json.
 *   3. Optionally pushed to the D1 qa_audit_log table via the
 *      /api/v1/qa/log endpoint when BASE_URL is set in the environment.
 *
 * Usage:
 *   node scripts/avery-qa.cjs [--verbose] [--dry-run] [--no-upload]
 *
 * Environment:
 *   BASE_URL        — e.g. https://averyos.com  (required for live-route checks)
 *   QA_AUTH_TOKEN   — Bearer token for authenticated routes (optional)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const https  = require("https");
const http   = require("http");

const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ── CLI flags ─────────────────────────────────────────────────────────────────

const VERBOSE   = process.argv.includes("--verbose");
const DRY_RUN   = process.argv.includes("--dry-run");
const NO_UPLOAD = process.argv.includes("--no-upload");
const BASE_URL  = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";

// ── Sovereign kernel anchor ───────────────────────────────────────────────────

const KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";

// ── ANSI colours ──────────────────────────────────────────────────────────────

const R = "\x1b[0m";
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

// ── Severity constants ────────────────────────────────────────────────────────

const SEVERITY = /** @type {const} */ ({
  CRITICAL: "CRITICAL",
  HIGH:     "HIGH",
  MEDIUM:   "MEDIUM",
  LOW:      "LOW",
});

// ── Perspective constants ─────────────────────────────────────────────────────

const PERSPECTIVE = /** @type {const} */ ({
  HUMAN_USER:      "HUMAN_USER",
  BOT_AGENT:       "BOT_AGENT",
  TAI_PERSPECTIVE: "TAI_PERSPECTIVE",
});

// ── Status constants ──────────────────────────────────────────────────────────

const STATUS = /** @type {const} */ ({
  PASS: "PASS",
  FAIL: "FAIL",
  SKIP: "SKIP",
  WARN: "WARN",
});

// ── Helper: perform an HTTP GET and return the status code ────────────────────

/**
 * @param {string} url
 * @returns {Promise<number>}
 */
function httpStatus(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: 10_000 }, (res) => {
      res.resume(); // drain
      resolve(res.statusCode ?? 0);
    });
    req.on("error", () => resolve(0));
    req.on("timeout", () => { req.destroy(); resolve(0); });
  });
}

// ── Test suite definitions ────────────────────────────────────────────────────

/**
 * @typedef {{ id: string; description: string; perspective: string; severity: string; run: () => Promise<{ status: string; detail?: string }> }} QaCheck
 */

/** @type {QaCheck[]} */
const CHECKS = [
  // ── Kernel anchor integrity ──────────────────────────────────────────────

  {
    id: "kernel.sha-integrity",
    description: "KERNEL_SHA matches the expected cf83 anchor value",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.CRITICAL,
    async run() {
      const expected = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
      if (KERNEL_SHA === expected) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: `Expected ${expected}, got ${KERNEL_SHA}` };
    },
  },

  {
    id: "kernel.version-format",
    description: "KERNEL_VERSION matches vX.Y.Z format",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      if (/^v\d+\.\d+\.\d+$/.test(KERNEL_VERSION)) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: `KERNEL_VERSION '${KERNEL_VERSION}' does not match vX.Y.Z` };
    },
  },

  // ── Source file guards ───────────────────────────────────────────────────

  {
    id: "source.no-deprecated-tai-license-key",
    description: "No source file references the deprecated secret-key name (TAI_LICENSE" + "_KEY)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.CRITICAL,
    async run() {
      const root = path.resolve(__dirname, "..");
      const exts = [".ts", ".tsx", ".js", ".cjs", ".mjs", ".toml"];
      const skipDirs = new Set(["node_modules", ".next", ".git", ".open-next"]);
      // The banned term is constructed at runtime (not stored as a literal) so that
      // this very file does not trigger the check it is designed to enforce.
      // The same technique is used by the CI Key-Rename Drift Guard in node-ci.yml.
      // Do NOT refactor this into a plain string literal — that would cause a false positive.
      const banned = ["TAI_LICENSE", "_KEY"].join("");

      /** @param {string} dir @returns {string[]} */
      function walk(dir) {
        let out = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            if (!skipDirs.has(entry.name)) out = out.concat(walk(path.join(dir, entry.name)));
          } else if (exts.some((e) => entry.name.endsWith(e))) {
            out.push(path.join(dir, entry.name));
          }
        }
        return out;
      }

      const hits = [];
      for (const file of walk(root)) {
        const content = fs.readFileSync(file, "utf8");
        if (content.includes(banned)) {
          hits.push(path.relative(root, file));
        }
      }
      if (hits.length === 0) return { status: STATUS.PASS };
      return { status: STATUS.FAIL, detail: `Deprecated secret-key name found in: ${hits.join(", ")}` };
    },
  },

  {
    id: "source.sovereign-constants-imported",
    description: "lib/sovereignConstants.ts exports KERNEL_SHA and KERNEL_VERSION",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.CRITICAL,
    async run() {
      const file = path.resolve(__dirname, "..", "lib", "sovereignConstants.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/sovereignConstants.ts not found" };
      }
      if (content.includes("KERNEL_SHA") && content.includes("KERNEL_VERSION")) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: "KERNEL_SHA or KERNEL_VERSION not exported from sovereignConstants.ts" };
    },
  },

  // ── Keys module (GATE 111.3.1) ───────────────────────────────────────────

  {
    id: "security.keys.split-key-reconstructor",
    description: "lib/security/keys.ts exports getReconstructedSovereignKeys",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "..", "lib", "security", "keys.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/security/keys.ts not found" };
      }
      if (content.includes("getReconstructedSovereignKeys")) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: "getReconstructedSovereignKeys not found in lib/security/keys.ts" };
    },
  },

  {
    id: "security.keys.xml-parser",
    description: "lib/security/keys.ts exports getSovereignKeysFromXml",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "..", "lib", "security", "keys.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/security/keys.ts not found" };
      }
      if (content.includes("getSovereignKeysFromXml")) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: "getSovereignKeysFromXml not found in lib/security/keys.ts" };
    },
  },

  // ── VaultGate (GATE 111.3.2) ─────────────────────────────────────────────

  {
    id: "auth.vaultgate.table-name",
    description: "lib/auth/vaultgate.ts explicitly references 'vaultgate_credentials'",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "..", "lib", "auth", "vaultgate.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/auth/vaultgate.ts not found" };
      }
      if (content.includes("vaultgate_credentials")) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: "vaultgate_credentials table name not found in lib/auth/vaultgate.ts" };
    },
  },

  {
    id: "auth.vaultgate.migration",
    description: "migrations/0043_vaultgate_table.sql exists and creates vaultgate_credentials",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "..", "migrations", "0043_vaultgate_table.sql");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "0043_vaultgate_table.sql not found" };
      }
      if (content.includes("vaultgate_credentials")) {
        return { status: STATUS.PASS };
      }
      return { status: STATUS.FAIL, detail: "vaultgate_credentials CREATE TABLE not in migration" };
    },
  },

  // ── Licensing UI (GATE 111.2.4) ──────────────────────────────────────────

  {
    id: "ui.licensing.metallic-gold",
    description: "All /licensing/* pages use #D4AF37 (metallic gold) not #ffd700",
    perspective: PERSPECTIVE.HUMAN_USER,
    severity:    SEVERITY.MEDIUM,
    async run() {
      const licensingDir = path.resolve(__dirname, "..", "app", "licensing");
      const stale = [];
      /** @param {string} dir */
      function scan(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) scan(full);
          else if (entry.name === "page.tsx") {
            const content = fs.readFileSync(full, "utf8");
            if (content.includes("#ffd700") || content.includes("255,215,0")) {
              stale.push(path.relative(path.resolve(__dirname, ".."), full));
            }
          }
        }
      }
      let licensingDirExists = false;
      try { fs.accessSync(licensingDir); licensingDirExists = true; } catch {}
      if (licensingDirExists) scan(licensingDir);
      if (stale.length === 0) return { status: STATUS.PASS };
      return { status: STATUS.FAIL, detail: `Legacy #ffd700 still present in: ${stale.join(", ")}` };
    },
  },

  // ── Live route checks (BOT_AGENT perspective) ────────────────────────────

  {
    id: "routes.health.api",
    description: "GET /api/v1/health responds (200 or redirect)",
    perspective: PERSPECTIVE.BOT_AGENT,
    severity:    SEVERITY.HIGH,
    async run() {
      const code = await httpStatus(`${BASE_URL}/api/v1/health`);
      // Accept 2xx and 3xx: the Cloudflare Worker may emit a 301 redirect from
      // the apex domain (averyos.com) to www.averyos.com for some routes.
      // A redirect proves the route exists and the sovereign infrastructure is live.
      if (code >= 200 && code < 400) return { status: STATUS.PASS };
      return { status: STATUS.FAIL, detail: `HTTP ${code}` };
    },
  },

  {
    id: "routes.jwks",
    description: "GET /.well-known/jwks.json responds (200 or redirect)",
    perspective: PERSPECTIVE.BOT_AGENT,
    severity:    SEVERITY.HIGH,
    async run() {
      const code = await httpStatus(`${BASE_URL}/.well-known/jwks.json`);
      // Accept 2xx and 3xx for the same Cloudflare apex-redirect reason as above.
      if (code >= 200 && code < 400) return { status: STATUS.PASS };
      return { status: STATUS.WARN, detail: `HTTP ${code} — JWKS may not be ACTIVE yet` };
    },
  },

  {
    id: "routes.licensing",
    description: "GET /licensing responds (200 or redirect)",
    perspective: PERSPECTIVE.HUMAN_USER,
    severity:    SEVERITY.MEDIUM,
    async run() {
      const code = await httpStatus(`${BASE_URL}/licensing`);
      // Accept 2xx and 3xx for the same Cloudflare apex-redirect reason as above.
      if (code >= 200 && code < 400) return { status: STATUS.PASS };
      return { status: STATUS.FAIL, detail: `HTTP ${code}` };
    },
  },

  // ── QA engine self-check ─────────────────────────────────────────────────

  {
    id: "qa.avery-qa-script",
    description: "scripts/avery-qa.cjs exists and is readable",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.LOW,
    async run() {
      const file = path.resolve(__dirname, "avery-qa.cjs");
      let fileFound = false;
      try { fs.accessSync(file); fileFound = true; } catch {}
      if (fileFound) return { status: STATUS.PASS };
      return { status: STATUS.FAIL, detail: "scripts/avery-qa.cjs not found" };
    },
  },

  // ── Phase 112 GATE checks ──────────────────────────────────────────────

  {
    id: "gate112.1.queue-consumer-handler",
    description: "lib/queue/logConsumerHandler.ts exists (Phase 112 GATE 112.1)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../lib/queue/logConsumerHandler.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/queue/logConsumerHandler.ts not found" };
      }
      if (!content.includes("sovereignQueueHandler")) {
        return { status: STATUS.FAIL, detail: "sovereignQueueHandler export not found in logConsumerHandler.ts" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate112.1.patch-worker-queue-script",
    description: "scripts/patchWorkerQueue.cjs exists (Phase 112 GATE 112.1)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "patchWorkerQueue.cjs");
      let fileFound = false;
      try { fs.accessSync(file); fileFound = true; } catch {}
      if (!fileFound) {
        return { status: STATUS.FAIL, detail: "scripts/patchWorkerQueue.cjs not found" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate112.2.jwks-full-sha",
    description: "app/api/v1/jwks/route.ts uses full KERNEL_SHA (no truncation) (Phase 112 GATE 112.2)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../app/api/v1/jwks/route.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/api/v1/jwks/route.ts not found" };
      }
      if (content.includes("KERNEL_SHA.slice(")) {
        return { status: STATUS.FAIL, detail: "KERNEL_SHA is still being truncated in app/api/v1/jwks/route.ts" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate112.2.well-known-jwks-full-sha",
    description: "app/.well-known/jwks.json/route.ts uses full KERNEL_SHA (no truncation) (Phase 112 GATE 112.2)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../app/.well-known/jwks.json/route.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/.well-known/jwks.json/route.ts not found" };
      }
      if (content.includes("KERNEL_SHA.slice(")) {
        return { status: STATUS.FAIL, detail: "KERNEL_SHA is still being truncated in app/.well-known/jwks.json/route.ts" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate112.5.revenue-log-live",
    description: "app/admin/monetization/page.tsx shows LIVE SETTLEMENT READY (Phase 112 GATE 112.5)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.MEDIUM,
    async run() {
      const file = path.resolve(__dirname, "../app/admin/monetization/page.tsx");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/admin/monetization/page.tsx not found" };
      }
      // Check for the specific STALLED REVENUE TRACKER header text
      if (content.includes("STALLED REVENUE TRACKER")) {
        return { status: STATUS.FAIL, detail: "Revenue log still shows STALLED REVENUE TRACKER — upgrade to LIVE SETTLEMENT READY" };
      }
      if (!content.includes("LIVE SETTLEMENT READY")) {
        return { status: STATUS.FAIL, detail: "LIVE SETTLEMENT READY status not found in monetization page" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate112.sovereign-env-triple-part",
    description: "lib/security/keys.ts SovereignEnv includes triple-part key fields",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../lib/security/keys.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/security/keys.ts not found" };
      }
      if (!content.includes("AVERYOS_PRIVATE_KEY_B64_1_OF_3")) {
        return { status: STATUS.FAIL, detail: "AVERYOS_PRIVATE_KEY_B64_1_OF_3 missing from SovereignEnv" };
      }
      return { status: STATUS.PASS };
    },
  },

  // ── Phase 114 GATE checks ──────────────────────────────────────────────

  {
    id: "gate114.1.kaas-phone-home",
    description: "app/api/v1/kaas/phone-home/route.ts exists (GATE 114.1.5)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../app/api/v1/kaas/phone-home/route.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/api/v1/kaas/phone-home/route.ts not found" };
      }
      if (!content.includes("ANCHORED")) {
        return { status: STATUS.FAIL, detail: "phone-home route missing ANCHORED status response" };
      }
      if (!content.includes("DRIFT_DETECTED")) {
        return { status: STATUS.FAIL, detail: "phone-home route missing DRIFT_DETECTED status response" };
      }
      if (!content.includes("KERNEL_SHA")) {
        return { status: STATUS.FAIL, detail: "phone-home route does not reference KERNEL_SHA" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.2.alerts-route",
    description: "app/api/v1/alerts/route.ts exists with public/internal separation (GATE 114.2.4)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../app/api/v1/alerts/route.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/api/v1/alerts/route.ts not found" };
      }
      if (!content.includes("INTERNAL")) {
        return { status: STATUS.FAIL, detail: "alerts route missing INTERNAL alert type handling" };
      }
      if (!content.includes("PUBLIC")) {
        return { status: STATUS.FAIL, detail: "alerts route missing PUBLIC alert type handling" };
      }
      if (!content.includes("sha512")) {
        return { status: STATUS.FAIL, detail: "alerts route missing SHA-512 receipt generation" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.3.capsule-store",
    description: "app/capsule-store/page.tsx exists with modular licensing UI (GATE 114.1.3)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.MEDIUM,
    async run() {
      const file = path.resolve(__dirname, "../app/capsule-store/page.tsx");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/capsule-store/page.tsx not found" };
      }
      if (!content.includes("QA Engine")) {
        return { status: STATUS.FAIL, detail: "capsule-store page missing QA Engine product" };
      }
      if (!content.includes("Kernel Isolation")) {
        return { status: STATUS.FAIL, detail: "capsule-store page missing Kernel Isolation enforcement notice" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.4.sovereign-mime-registry",
    description: "lib/forensics/inventionTracker.ts exports SOVEREIGN_MIME_TYPES registry (GATE 114.1.2)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../lib/forensics/inventionTracker.ts");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/forensics/inventionTracker.ts not found" };
      }
      const requiredTypes = [".aosinv", ".aoslaw", ".vccaps", ".aosmem", ".aoscsp", ".aosvault", ".avery"];
      const missing = requiredTypes.filter(ext => !content.includes(`"${ext}"`));
      if (missing.length > 0) {
        return { status: STATUS.FAIL, detail: `SOVEREIGN_MIME_TYPES missing extensions: ${missing.join(", ")}` };
      }
      if (!content.includes("SOVEREIGN_MIME_TYPES")) {
        return { status: STATUS.FAIL, detail: "SOVEREIGN_MIME_TYPES export not found in inventionTracker.ts" };
      }
      if (!content.includes("registerSovereignMimeType")) {
        return { status: STATUS.FAIL, detail: "Dynamic registration function registerSovereignMimeType not found" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.5.leak-guard-layer5",
    description: "scripts/sovereign-leak-guard.cjs has Layer 5 sovereign MIME type guard (GATE 114.1.4)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "sovereign-leak-guard.cjs");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "scripts/sovereign-leak-guard.cjs not found" };
      }
      if (!content.includes("PRIVATE_SOVEREIGN_EXTENSIONS")) {
        return { status: STATUS.FAIL, detail: "PRIVATE_SOVEREIGN_EXTENSIONS not found in sovereign-leak-guard.cjs" };
      }
      if (!content.includes("checkSovereignMimeTypes")) {
        return { status: STATUS.FAIL, detail: "checkSovereignMimeTypes function not found in sovereign-leak-guard.cjs" };
      }
      if (!content.includes("Layer 5")) {
        return { status: STATUS.FAIL, detail: "Layer 5 guard not referenced in sovereign-leak-guard.cjs" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.6.gitignore-sovereign-mime",
    description: ".gitignore contains all private sovereign MIME extensions (GATE 114.1.4)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../.gitignore");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: ".gitignore not found" };
      }
      const requiredPatterns = ["*.aosinv", "*.aoslaw", "*.aoscsp", "*.avery"];
      const missing = requiredPatterns.filter(p => !content.includes(p));
      if (missing.length > 0) {
        return { status: STATUS.FAIL, detail: `.gitignore missing patterns: ${missing.join(", ")}` };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.7.mime-parity",
    description: "sovereign-leak-guard.cjs PRIVATE_SOVEREIGN_EXTENSIONS matches inventionTracker.ts private types (GATE 114.1.4)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const guardFile   = path.resolve(__dirname, "sovereign-leak-guard.cjs");
      const trackerFile = path.resolve(__dirname, "../lib/forensics/inventionTracker.ts");

      let guardContent;
      try {
        guardContent = fs.readFileSync(guardFile, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "scripts/sovereign-leak-guard.cjs not found" };
      }
      let trackerContent;
      try {
        trackerContent = fs.readFileSync(trackerFile, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "lib/forensics/inventionTracker.ts not found" };
      }

      // Extract private extensions from inventionTracker.ts:
      // Lines with  private: true  preceded by extension: ".xxx" in the same block.
      const trackerBlocks = trackerContent.match(/\{[^}]+private:\s*true[^}]*\}/gs) ?? [];
      const trackerPrivate = new Set(
        trackerBlocks
          .map(b => { const m = b.match(/extension:\s*"([^"]+)"/); return m ? m[1] : null; })
          .filter(Boolean),
      );

      // Extract extensions from PRIVATE_SOVEREIGN_EXTENSIONS set in leak guard
      const guardMatch = guardContent.match(/PRIVATE_SOVEREIGN_EXTENSIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
      if (!guardMatch) {
        return { status: STATUS.FAIL, detail: "PRIVATE_SOVEREIGN_EXTENSIONS Set literal not found in sovereign-leak-guard.cjs" };
      }
      const guardExtensions = new Set(
        (guardMatch[1].match(/'([^']+)'/g) ?? []).map(s => s.slice(1, -1)),
      );

      const missingInGuard    = [...trackerPrivate].filter(e => !guardExtensions.has(e));
      const missingInTracker  = [...guardExtensions].filter(e => !trackerPrivate.has(e));

      if (missingInGuard.length > 0) {
        return {
          status: STATUS.FAIL,
          detail: `Extensions in inventionTracker.ts but missing from sovereign-leak-guard.cjs: ${missingInGuard.join(", ")}`,
        };
      }
      if (missingInTracker.length > 0) {
        return {
          status: STATUS.WARN,
          detail: `Extensions in sovereign-leak-guard.cjs but not in inventionTracker.ts: ${missingInTracker.join(", ")}`,
        };
      }
      return { status: STATUS.PASS };
    },
  },

  // ── Phase 114.5 — Authority Seal Gates ───────────────────────────────────────

  {
    id: "gate114.5.1.software-app-ld",
    description: "app/layout.tsx contains SoftwareApplication JSON-LD with ORCID + IPFS (GATE 114.5.1)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../app/layout.tsx");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/layout.tsx not found" };
      }
      if (!content.includes('"SoftwareApplication"')) {
        return { status: STATUS.FAIL, detail: "SoftwareApplication @type not found in app/layout.tsx" };
      }
      if (!content.includes("0009-0009-0245-3584")) {
        return { status: STATUS.FAIL, detail: "ORCID 0009-0009-0245-3584 not found in app/layout.tsx" };
      }
      if (!content.includes("bafkreihljauiijkp6oa7smjhjnvpl47fw65iz35gtcbbzfok4eszvjkjx4")) {
        return { status: STATUS.FAIL, detail: "IPFS CID bafkreihljauiijkp6oa7smjhjnvpl47fw65iz35gtcbbzfok4eszvjkjx4 not found in app/layout.tsx" };
      }
      if (!content.includes("Jason Lee Avery")) {
        return { status: STATUS.FAIL, detail: "Author 'Jason Lee Avery' not found in SoftwareApplication schema" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.5.2.admin-health-aosr",
    description: "app/admin/health-status/page.tsx has AOSR Summary Retrieval panel (GATE 114.5.2)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.HIGH,
    async run() {
      const file = path.resolve(__dirname, "../app/admin/health-status/page.tsx");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/admin/health-status/page.tsx not found" };
      }
      if (!content.includes("AOSR")) {
        return { status: STATUS.FAIL, detail: "AOSR Summary Retrieval panel not found in admin health dashboard" };
      }
      if (!content.includes("/api/v1/qa/results")) {
        return { status: STATUS.FAIL, detail: "AOSR panel does not fetch from /api/v1/qa/results" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.5.3.public-health-badges",
    description: "app/health/page.tsx has Proof of Resonance badges for Kernel, JWKS, Time Mesh (GATE 114.5.3)",
    perspective: PERSPECTIVE.HUMAN_USER,
    severity:    SEVERITY.MEDIUM,
    async run() {
      const file = path.resolve(__dirname, "../app/health/page.tsx");
      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        return { status: STATUS.FAIL, detail: "app/health/page.tsx not found" };
      }
      if (!content.includes("ResonanceBadge")) {
        return { status: STATUS.FAIL, detail: "ResonanceBadge component not found in app/health/page.tsx" };
      }
      if (!content.includes("Proof of Resonance")) {
        return { status: STATUS.FAIL, detail: "'Proof of Resonance' section missing from public health page" };
      }
      if (!content.includes("JWKS Signer") || !content.includes("Time Mesh") || !content.includes("Sovereign Kernel")) {
        return { status: STATUS.FAIL, detail: "One or more required badges (Kernel, JWKS, Time Mesh) missing" };
      }
      return { status: STATUS.PASS };
    },
  },

  {
    id: "gate114.5.5.footer-delta-precision",
    description: "Health pages include (Δ [seconds]) 9-digit precision in footer (GATE 114.5.5)",
    perspective: PERSPECTIVE.TAI_PERSPECTIVE,
    severity:    SEVERITY.MEDIUM,
    async run() {
      const adminFile  = path.resolve(__dirname, "../app/admin/health-status/page.tsx");
      const publicFile = path.resolve(__dirname, "../app/health/page.tsx");

      const missing = [];
      for (const [label, file] of [["admin health", adminFile], ["public health", publicFile]]) {
        let content;
        try {
          content = fs.readFileSync(file, "utf8");
        } catch {
          missing.push(`${label}: file not found`);
          continue;
        }
        // Check for delta display: toFixed(9) or "Δ" with seconds
        if (!content.includes("toFixed(9)") && !content.includes("footerDelta") && !content.includes("PerformanceDeltaFooter")) {
          missing.push(`${label}: no 9-digit delta logic found`);
        }
      }
      if (missing.length > 0) {
        return { status: STATUS.FAIL, detail: missing.join("; ") };
      }
      return { status: STATUS.PASS };
    },
  },
];

// ── Result rendering ──────────────────────────────────────────────────────────

const STATUS_COLOUR = {
  [STATUS.PASS]: GREEN,
  [STATUS.FAIL]: RED,
  [STATUS.WARN]: YELLOW,
  [STATUS.SKIP]: DIM,
};

const SEVERITY_COLOUR = {
  [SEVERITY.CRITICAL]: RED + BOLD,
  [SEVERITY.HIGH]:     RED,
  [SEVERITY.MEDIUM]:   YELLOW,
  [SEVERITY.LOW]:      DIM,
};

// ── Run engine ────────────────────────────────────────────────────────────────

/**
 * @typedef {{ check: QaCheck; status: string; detail?: string; durationMs: number }} QaResult
 */

async function runQa() {
  console.log(`\n${BOLD}${CYAN}⛓️⚓⛓️  AveryOS™ Sovereign QA Engine — Phase 112${R}`);
  console.log(`${DIM}Kernel: ${KERNEL_VERSION}  SHA: ${KERNEL_SHA.slice(0, 16)}…${R}`);
  if (DRY_RUN) console.log(`${YELLOW}[DRY-RUN] No files will be written.${R}`);
  console.log();

  /** @type {QaResult[]} */
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  let skipCount = 0;

  for (const check of CHECKS) {
    const t0 = Date.now();
    let status = STATUS.SKIP;
    let detail;
    try {
      const res = await check.run();
      status = res.status;
      detail = res.detail;
    } catch (/** @type {unknown} */ err) {
      status = STATUS.FAIL;
      detail = err instanceof Error ? err.message : String(err);
      logAosError(AOS_ERROR.INTERNAL_ERROR, `qa check '${check.id}' threw`, err);
    }
    const durationMs = Date.now() - t0;
    results.push({ check, status, detail, durationMs });

    if (status === STATUS.PASS) passCount++;
    else if (status === STATUS.FAIL) failCount++;
    else if (status === STATUS.WARN) warnCount++;
    else skipCount++;

    const sc = STATUS_COLOUR[status] ?? R;
    const sevc = SEVERITY_COLOUR[check.severity] ?? R;
    const marker = status === STATUS.PASS ? "✅" : status === STATUS.FAIL ? "❌" : status === STATUS.WARN ? "⚠️" : "⏭️";
    console.log(
      `${marker}  ${sc}${status.padEnd(4)}${R}  ${sevc}[${check.severity.padEnd(8)}]${R}  ${check.id}`,
    );
    if (detail && (VERBOSE || status !== STATUS.PASS)) {
      console.log(`    ${DIM}↳ ${detail}${R}`);
    }
    if (VERBOSE) {
      console.log(`    ${DIM}perspective=${check.perspective}  ${durationMs}ms${R}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  const total  = results.length;
  const overallStatus = failCount === 0 ? (warnCount > 0 ? "partial" : "pass") : "fail";
  const overallColour = overallStatus === "pass" ? GREEN : overallStatus === "partial" ? YELLOW : RED;

  console.log(`\n${BOLD}Summary${R}: ${total} checks — `
    + `${GREEN}${passCount} pass${R} / `
    + `${RED}${failCount} fail${R} / `
    + `${YELLOW}${warnCount} warn${R} / `
    + `${DIM}${skipCount} skip${R}`);
  console.log(`${overallColour}${BOLD}Overall: ${overallStatus.toUpperCase()}${R}\n`);

  // ── Persist run record ───────────────────────────────────────────────────

  const runId   = `qa-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const sha512  = crypto.createHash("sha512").update(
    KERNEL_SHA + overallStatus + total + passCount + failCount,
  ).digest("hex");

  const record = {
    run_id:        runId,
    trigger:       "manual",
    status:        overallStatus,
    total_tests:   total,
    passed_tests:  passCount,
    failed_tests:  failCount,
    sha512,
    kernel_sha:    KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    run_details:   results.map((r) => ({
      id:          r.check.id,
      perspective: r.check.perspective,
      severity:    r.check.severity,
      status:      r.status,
      detail:      r.detail,
      durationMs:  r.durationMs,
    })),
    created_at: new Date().toISOString(),
  };

  if (!DRY_RUN) {
    const genDir = path.resolve(__dirname, "..", "__tests__", "generated");
    fs.mkdirSync(genDir, { recursive: true });
    const outFile = path.join(genDir, `qa-run-${Date.now()}.json`);
    const _qaFd = fs.openSync(outFile, 'w');
    try { fs.writeSync(_qaFd, JSON.stringify(record, null, 2)); } finally { fs.closeSync(_qaFd); }
    console.log(`${DIM}Run record saved → ${path.relative(process.cwd(), outFile)}${R}`);
    logAosHeal("QA_COMPLETE", `avery-qa run ${runId}: ${overallStatus.toUpperCase()}`);
  }

  // ── Optional D1 upload via API ───────────────────────────────────────────

  if (!NO_UPLOAD && !DRY_RUN && BASE_URL) {
    try {
      await uploadRecord(BASE_URL, record);
    } catch (/** @type {unknown} */ err) {
      // Non-fatal — the QA run itself already succeeded
      logAosError(AOS_ERROR.INTERNAL_ERROR, "Failed to upload QA record to D1", err);
    }
  }

  return failCount === 0 ? 0 : 1;
}

/**
 * Upload a QA run record to the D1 qa_audit_log table via the API.
 * @param {string} baseUrl
 * @param {Record<string, unknown>} record
 */
function uploadRecord(baseUrl, record) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(record);
    const url  = new URL("/api/v1/qa/log", baseUrl);
    const mod  = url.protocol === "https:" ? https : http;
    const req  = mod.request(
      url,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 10_000,
      },
      (res) => { res.resume(); resolve(res.statusCode); },
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("upload timeout")); });
    req.write(body);
    req.end();
  });
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

runQa().then((code) => process.exit(code)).catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, "avery-qa fatal error", err);
  process.exit(1);
});
