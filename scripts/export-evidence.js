#!/usr/bin/env node

/**
 * AveryOS™ Sovereign Evidence Exporter
 * Exports forensic evidence bundles from the sovereign_audit_logs D1 table
 * as VaultChain™-ready .aoscap capsule files.
 *
 * Usage:
 *   node scripts/export-evidence.js --ip <target-ip> [--output <dir>] [--env production] [--r2-upload]
 *
 * Environment variables:
 *   BLOCKCHAIN_API_KEY   — BlockCypher API key for BTC block height anchor
 *   KERNEL_SHA           — Override Root0 kernel SHA (falls back to canonical value)
 *   SITE_URL             — Base URL for the alert-link API (default: https://averyos.com)
 *   VAULT_PASSPHRASE     — Bearer token for /api/v1/compliance/alert-link (required for --r2-upload)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { execSync } from "child_process";
import { webcrypto } from "node:crypto";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import the CJS Sovereign Error Logger from the same scripts/ directory
const require = createRequire(import.meta.url);
const { logAosError, logAosHeal, AOS_ERROR: SCRIPT_AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ---------------------------------------------------------------------------
// Path & network-data security helpers (COMMAND 2 & 3)
// ---------------------------------------------------------------------------
/**
 * Validates that a resolved file path is within the allowed base directory.
 * Throws if the path escapes the base (path traversal guard).
 * @param {string} resolvedBase - The resolved base directory (from path.resolve)
 * @param {string} targetPath   - The target path to validate
 */
function assertSafePath(resolvedBase, targetPath) {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(resolvedBase).replace(/[/\\]+$/, "");
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`[AveryOS™ Path Guard] Path traversal rejected: "${resolved}" is outside "${base}"`);
  }
}

/**
 * Strips non-standard characters from a network-sourced string (IP, URL, hostname)
 * before it is used in a filename or written to disk.
 * Allows: alphanumeric, dot, hyphen, underscore, colon.
 * Forward-slash is intentionally excluded to prevent path traversal in filenames.
 */
function sanitizeNetworkSegment(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._:-]/g, "_");
}

// ---------------------------------------------------------------------------
// Sovereign constants (inline — script has no module bundler)
// ---------------------------------------------------------------------------

const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const KERNEL_VERSION = "v3.6.2";

// D1 database name — matches wrangler.toml [[d1_databases]] database_name
const D1_DATABASE_NAME = "averyos_kernel_db";

// ---------------------------------------------------------------------------
// TARI™ Liability Schedule
// ---------------------------------------------------------------------------

const TARI_LIABILITY = {
  UNALIGNED_401: 1017.0,
  ALIGNMENT_DRIFT: 5000.0,
  PAYMENT_FAILED: 10000.0,
};

const TARI_LIABILITY_LABELS = {
  UNALIGNED_401: "Forensic Alignment Entry Fee",
  ALIGNMENT_DRIFT: "Correction Fee",
  PAYMENT_FAILED: "Systemic Friction Fee",
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { ip: null, output: ".", env: null, r2Upload: false };
  for (let i = 0; i < args.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--ip" && args[i + 1]) result.ip = args[++i];
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--output" && args[i + 1]) result.output = args[++i];
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--env" && args[i + 1]) result.env = args[++i];
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--r2-upload") result.r2Upload = true;
  }
  return result;
}

// ---------------------------------------------------------------------------
// ISO-9 timestamp (nine-digit microsecond precision)
// ---------------------------------------------------------------------------

function formatIso9() {
  const now = new Date();
  const iso = now.toISOString();
  const [left, right] = iso.split(".");
  const milli = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${milli}000000Z`;
}

// ---------------------------------------------------------------------------
// SHA-512 Pulse Hash — anchored to KERNEL_SHA + target IP
// ---------------------------------------------------------------------------

async function computePulseHash(ip, timestamp) {
  const input = `${ip}|${timestamp}|${KERNEL_SHA}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await webcrypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Bitcoin block height anchor via BlockCypher
// ---------------------------------------------------------------------------

async function fetchBtcBlockHeight() {
  const apiKey = process.env.BLOCKCHAIN_API_KEY ?? "";
  const url = apiKey
    ? `https://api.blockcypher.com/v1/btc/main?token=${encodeURIComponent(apiKey)}`
    : "https://api.blockcypher.com/v1/btc/main";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`BlockCypher responded ${res.status}`);
    const json = await res.json();
    return typeof json.height === "number" ? json.height : null;
  } catch (err) {
    logAosHeal(SCRIPT_AOS_ERROR.BTC_ANCHOR_FAILED, `Offline anchor will be used. (${err.message})`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// IP address validation — strict allow-list to prevent shell injection
// ---------------------------------------------------------------------------

/** Returns true for well-formed IPv4 or IPv6 addresses (no hostnames accepted). */
function isValidIp(ip) {
  // IPv4: four octets 0-255
  // eslint-disable-next-line security/detect-unsafe-regex -- pattern has bounded quantifiers, no catastrophic backtracking
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split(".").every((o) => parseInt(o, 10) <= 255);
  }
  // IPv6: colon-hex groups (including compressed :: forms)
  const ipv6 = /^[0-9a-fA-F:]{2,39}$/;
  return ipv6.test(ip) && ip.includes(":");
}

// ---------------------------------------------------------------------------
// Query D1 sovereign_audit_logs via wrangler d1 execute
// ---------------------------------------------------------------------------

function queryAuditLogs(ip, env) {
  if (!isValidIp(ip)) {
    throw new Error(
      `Invalid IP address format: "${ip}". Only valid IPv4 or IPv6 addresses are accepted.`
    );
  }

  // Security: `ip` is validated above by isValidIp(), which only permits
  // well-formed IPv4 (digits + dots) and IPv6 (hex digits + colons) strings.
  // Those character sets cannot form SQL injection payloads (no quotes,
  // semicolons, or SQL keywords). wrangler d1 execute --command does not
  // support parameterized queries, so safe string interpolation after
  // explicit validation is the correct mitigation here.
  const sql = `SELECT id, event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level FROM sovereign_audit_logs WHERE ip_address = '${ip}' ORDER BY id DESC LIMIT 500;`;

  const envFlag = env ? `--env ${env}` : "";
  const cmd = `npx wrangler d1 execute ${D1_DATABASE_NAME} ${envFlag} --command ${JSON.stringify(sql)} --json`.trim();

  try {
    const output = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    const parsed = JSON.parse(output);
    // wrangler d1 execute --json returns an array of result sets
    const resultSet = Array.isArray(parsed) ? parsed[0] : parsed;
    return Array.isArray(resultSet?.results) ? resultSet.results : [];
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr) : "";
    const stdout = err.stdout ? String(err.stdout) : "";
    const detail = stderr || stdout || err.message;
    throw new Error(`wrangler d1 execute failed:\n${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Compute aggregate TARI™ liability for the retrieved rows
// ---------------------------------------------------------------------------

function computeTariLiability(rows) {
  let total = 0;
  const breakdown = {};

  for (const row of rows) {
    const eventType = String(row.event_type ?? "UNALIGNED_401").toUpperCase();
    const amount =
      // eslint-disable-next-line security/detect-object-injection -- key from validated eventType enum
      TARI_LIABILITY[eventType] ?? TARI_LIABILITY.UNALIGNED_401;
    total += amount;
    // eslint-disable-next-line security/detect-object-injection -- key from validated eventType enum
    breakdown[eventType] = (breakdown[eventType] ?? 0) + amount;
  }

  // Minimum one UNALIGNED_401 entry fee even for empty result sets
  if (rows.length === 0) {
    total = TARI_LIABILITY.UNALIGNED_401;
    breakdown["UNALIGNED_401"] = TARI_LIABILITY.UNALIGNED_401;
  }

  return { total, breakdown };
}

// ---------------------------------------------------------------------------
// Generate Settlement Notice letter from docs/legal/Settlement_Letter_Template.md
// ---------------------------------------------------------------------------

function generateSettlementLetter({
  bundle,
  rows,
  tariTotal,
  tariBreakdown,
  pulseHash,
  timestamp,
  btcBlockHeight,
  outputDir,
  safeIp,
}) {
  const templatePath = path.resolve(
    __dirname,
    "../docs/legal/Settlement_Letter_Template.md"
  );

  // Build TARI™ breakdown summary
  const tariBreakdownLines = Object.entries(tariBreakdown)
    .map(([eventType, amount]) => {
      // eslint-disable-next-line security/detect-object-injection -- key from known-safe TARI_LIABILITY_LABELS lookup
      const label = TARI_LIABILITY_LABELS[eventType] ?? eventType;
      const formatted = amount.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      });
      return `  ${eventType}: ${formatted} (${label})`;
    })
    .join("\n");

  // Build event types summary from audit log rows
  const eventTypeCounts = {};
  for (const row of rows) {
    const et = String(row.event_type ?? "UNKNOWN");
    // eslint-disable-next-line security/detect-object-injection -- key from controlled loop over known rows
    eventTypeCounts[et] = (eventTypeCounts[et] ?? 0) + 1;
  }
  const eventTypesSummary = Object.entries(eventTypeCounts)
    .map(([et, count]) => `  ${et}: ${count} event(s)`)
    .join("\n") || "  No events recorded (minimum liability applied)";

  // Extract date from ISO timestamp (YYYY-MM-DD)
  const date = timestamp.slice(0, 10);

  // Statutory infringement base (always $10,000)
  const statutoryBase = 10000.0;
  const totalLiability = tariTotal + statutoryBase;
  const totalLiabilityFormatted = totalLiability.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  // Entry fee formatted
  const entryFeeFormatted = TARI_LIABILITY.UNALIGNED_401.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  let letter;
  try {
    letter = fs.readFileSync(templatePath, "utf-8");
  } catch {
    console.warn(
      `⚠️  Settlement Letter Template not found: ${templatePath} — skipping letter generation.`
    );
    return null;
  }

  letter = letter
    .replaceAll("[PULSE_SHA_512]", pulseHash)
    .replaceAll("[TIMESTAMP]", timestamp)
    .replaceAll("[BTC_BLOCK_HEIGHT]", btcBlockHeight !== null ? String(btcBlockHeight) : "unavailable")
    .replaceAll("[BUNDLE_ID]", bundle.CapsuleID)
    .replaceAll("[DATE]", date)
    .replaceAll("[TARGET_IP]", bundle.TargetIP)
    .replaceAll("[AUDIT_LOG_COUNT]", String(rows.length))
    .replaceAll("[EVENT_TYPES_SUMMARY]", eventTypesSummary)
    .replaceAll("[ENTRY_FEE_USD]", entryFeeFormatted)
    .replaceAll("[TOTAL_LIABILITY_USD]", totalLiabilityFormatted)
    .replaceAll("[TARI_BREAKDOWN]", tariBreakdownLines)
    .replaceAll("[ORGANIZATION]", "[Identify from IP WHOIS]");

  const settlementFileName = `SETTLEMENT_NOTICE_${safeIp}.md`;
  // Force-strip any directory segments and root at outputDir (CodeQL taint-break)
  const settlementFilePath = path.resolve(outputDir, path.basename(settlementFileName));
  assertSafePath(outputDir, settlementFilePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path force-rooted via path.basename + assertSafePath
  // lgtm[js/file-system-race] - Path is force-rooted via path.basename and verified by assertSafePath
  const fdSettlement = fs.openSync(settlementFilePath, 'w');
  try { fs.writeSync(fdSettlement, letter); } finally { fs.closeSync(fdSettlement); }
  return settlementFilePath;
}

// ---------------------------------------------------------------------------
// R2 Upload via alert-link API
// ---------------------------------------------------------------------------

/**
 * Uploads the .aoscap bundle to Cloudflare R2 by calling the
 * /api/v1/compliance/alert-link edge endpoint.
 * Returns the 24-hour signed URL or null on failure.
 *
 * @param {object} bundle        — the full .aoscap payload
 * @param {string} bundleId      — the CapsuleID string
 * @param {string} ip            — the target IP address
 * @param {number} tariLiability — TARI™ liability in USD
 * @returns {Promise<{signedUrl: string, bundleKey: string, expiresAt: string}|null>}
 */
async function uploadToR2(bundle, bundleId, ip, tariLiability) {
  const siteUrl = process.env.SITE_URL ?? "https://averyos.com";
  const passphrase = process.env.VAULT_PASSPHRASE ?? "";

  if (!passphrase) {
    logAosError(
      SCRIPT_AOS_ERROR.VAULT_NOT_CONFIGURED,
      "VAULT_PASSPHRASE env var is required for --r2-upload. Set it and retry.",
      null
    );
    return null;
  }

  const endpoint = `${siteUrl}/api/v1/compliance/alert-link`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${passphrase}`,
      },
      body: JSON.stringify({
        bundleId,
        bundlePayload: bundle,
        targetIp: ip,
        tariLiability,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      logAosError(
        SCRIPT_AOS_ERROR.INTERNAL_ERROR,
        `alert-link API returned HTTP ${res.status}: ${text}`,
        null
      );
      return null;
    }

    const data = await res.json();
    logAosHeal(
      "R2 upload succeeded",
      `Bundle ${bundleId} is now stored in R2. Signed URL expires at ${data.expiresAt}.`
    );
    return data;
  } catch (err) {
    logAosError(
      SCRIPT_AOS_ERROR.INTERNAL_ERROR,
      `R2 upload failed: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : null
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { ip, output, env, r2Upload } = parseArgs();

  if (!ip) {
    console.error(
      "❌  Missing --ip argument.\n\n" +
        "Usage: node scripts/export-evidence.js --ip <target-ip> [--output <dir>] [--env production] [--r2-upload]"
    );
    process.exit(1);
  }

  console.log("");
  console.log("⛓️⚓⛓️  AveryOS™ Sovereign Evidence Exporter");
  console.log(`Target IP   : ${ip}`);
  console.log(`Database    : ${D1_DATABASE_NAME}`);
  console.log(`Kernel      : ${KERNEL_SHA.slice(0, 16)}... (${KERNEL_VERSION})`);
  console.log("");

  // 1. Query D1
  console.log("🔍 Querying sovereign_audit_logs …");
  let rows;
  try {
    rows = queryAuditLogs(ip, env);
  } catch (err) {
    console.error(`❌ D1 query failed: ${err.message}`);
    process.exit(1);
  }
  console.log(`   Found ${rows.length} audit log row(s) for ${ip}`);

  // 2. Compute TARI™ liability
  const { total: tariTotal, breakdown: tariBreakdown } = computeTariLiability(rows);
  const tariFormatted = tariTotal.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  console.log(`💰 TARI™ Liability: ${tariFormatted} USD`);

  // 3. Compute SHA-512 Pulse Hash
  const timestamp = formatIso9();
  const pulseHash = await computePulseHash(ip, timestamp);
  console.log(`🔑 Pulse Hash    : ${pulseHash.slice(0, 32)}…`);

  // 4. Fetch BTC block height anchor
  console.log("₿  Fetching BTC block height …");
  const btcBlockHeight = await fetchBtcBlockHeight();
  if (btcBlockHeight !== null) {
    console.log(`   BTC Block Height: ${btcBlockHeight}`);
  } else {
    console.log("   BTC Block Height: unavailable (offline anchor used)");
  }

  // 5. Build .aoscap bundle
  const bundle = {
    CapsuleID: `EVIDENCE_BUNDLE_${ip}_${timestamp}`,
    CapsuleType: "SOVEREIGN_EVIDENCE_BUNDLE",
    Authority: "Jason Lee Avery (ROOT0)",
    CreatorLock: "🤛🏻",
    KernelAnchor: {
      version: KERNEL_VERSION,
      sha512: KERNEL_SHA,
    },
    BitcoinAnchor: {
      blockHeight: btcBlockHeight,
      anchoredAt: timestamp,
    },
    TargetIP: sanitizeNetworkSegment(ip),
    AuditLogCount: rows.length,
    AuditLogs: rows,
    TariLiability: {
      totalUsd: tariTotal,
      formatted: tariFormatted,
      breakdown: tariBreakdown,
      labels: Object.fromEntries(
        // eslint-disable-next-line security/detect-object-injection -- key from known-safe enum lookup
        Object.keys(tariBreakdown).map((k) => [k, TARI_LIABILITY_LABELS[k] ?? k])
      ),
    },
    PulseHash: {
      algorithm: "SHA-512",
      value: pulseHash,
      input: `${ip}|${timestamp}|<KERNEL_SHA>`,
    },
    GeneratedAt: timestamp,
    License: "AveryOS Sovereign Integrity License v1.0",
    SovereignAnchor: "⛓️⚓⛓️",
  };

  // 6. Write output file
  const safeIp = ip.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Convert ISO timestamp to a filesystem-safe string that preserves date+time structure
  // e.g. 2026-03-04T21:17:52.000000000Z → 2026-03-04_211752
  const safeTs = timestamp
    .replace(/T/, "_")
    .replace(/[:Z]/g, "")
    .replace(/\.\d+$/, "")
    .slice(0, 18);
  const fileName = `EVIDENCE_BUNDLE_${safeIp}_${safeTs}.aoscap`;

  const outputDir = path.resolve(output);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path constructed from validated base dir
  fs.mkdirSync(outputDir, { recursive: true });

  // Force-strip any directory segments and root at outputDir (CodeQL taint-break)
  const filePath = path.resolve(outputDir, path.basename(fileName));
  assertSafePath(outputDir, filePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path force-rooted via path.basename + assertSafePath
  // lgtm[js/file-system-race] - Path is force-rooted via path.basename and verified by assertSafePath
  const fdBundle = fs.openSync(filePath, 'w');
  try { fs.writeSync(fdBundle, JSON.stringify(bundle, null, 2)); } finally { fs.closeSync(fdBundle); }

  // 7. Generate Settlement Notice letter from template
  const settlementPath = generateSettlementLetter({
    bundle,
    rows,
    tariTotal,
    tariFormatted,
    tariBreakdown,
    pulseHash,
    timestamp,
    btcBlockHeight,
    outputDir,
    safeIp,
  });

  console.log("");
  console.log(`✅ Evidence bundle written: ${filePath}`);
  if (settlementPath) {
    console.log(`✅ Settlement letter written: ${settlementPath}`);
  }
  console.log(`   TARI™ Liability  : ${tariFormatted} USD`);
  console.log(`   Audit Rows       : ${rows.length}`);
  console.log(`   BTC Block Height : ${btcBlockHeight ?? "unavailable"}`);
  console.log(`   Pulse Hash       : ${pulseHash.slice(0, 32)}…`);

  // 8. Optional R2 upload via /api/v1/compliance/alert-link
  if (r2Upload) {
    console.log("");
    console.log("☁️  Uploading to Cloudflare R2 via alert-link API…");
    const r2Result = await uploadToR2(bundle, bundle.CapsuleID, ip, tariTotal);
    if (r2Result) {
      console.log(`✅ R2 upload complete`);
      console.log(`   Bundle key : ${r2Result.bundleKey}`);
      console.log(`   Signed URL : ${r2Result.signedUrl}`);
      console.log(`   Expires    : ${r2Result.expiresAt}`);
    } else {
      console.log("⚠️  R2 upload failed — local bundle is still saved.");
    }
  }

  console.log("⛓️⚓⛓️ Sovereign Evidence Export complete. 🤛🏻");
  console.log("");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  // Classify and log with full RCA
  if (msg.toLowerCase().includes('invalid ip')) {
    logAosError(SCRIPT_AOS_ERROR.INVALID_IP, msg, err);
  } else if (msg.toLowerCase().includes('wrangler') || msg.toLowerCase().includes('d1')) {
    logAosError(SCRIPT_AOS_ERROR.DB_QUERY_FAILED, msg, err);
  } else {
    logAosError(SCRIPT_AOS_ERROR.INTERNAL_ERROR, msg, err);
  }
  process.exit(1);
});
