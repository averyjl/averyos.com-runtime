#!/usr/bin/env node

/**
 * AveryOS™ Sovereign Evidence Exporter
 * Exports forensic evidence bundles from the sovereign_audit_logs D1 table
 * as VaultChain™-ready .aoscap capsule files.
 *
 * Usage:
 *   node scripts/export-evidence.js --ip <target-ip> [--output <dir>] [--env production]
 *
 * Environment variables:
 *   BLOCKCHAIN_API_KEY   — BlockCypher API key for BTC block height anchor
 *   KERNEL_SHA           — Override Root0 kernel SHA (falls back to canonical value)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { execSync } from "child_process";
import { webcrypto } from "node:crypto";
import fs from "fs";
import path from "path";

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
  const result = { ip: null, output: ".", env: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ip" && args[i + 1]) result.ip = args[++i];
    if (args[i] === "--output" && args[i + 1]) result.output = args[++i];
    if (args[i] === "--env" && args[i + 1]) result.env = args[++i];
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
    console.warn(`⚠️  Could not fetch BTC block height: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// IP address validation — strict allow-list to prevent shell injection
// ---------------------------------------------------------------------------

/** Returns true for well-formed IPv4 or IPv6 addresses (no hostnames accepted). */
function isValidIp(ip) {
  // IPv4: four octets 0-255
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
    throw new Error(
      `wrangler d1 execute failed:\n${stderr || stdout || err.message}`
    );
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
      TARI_LIABILITY[eventType] ?? TARI_LIABILITY.UNALIGNED_401;
    total += amount;
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { ip, output, env } = parseArgs();

  if (!ip) {
    console.error(
      "❌  Missing --ip argument.\n\n" +
        "Usage: node scripts/export-evidence.js --ip <target-ip> [--output <dir>] [--env production]"
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
    TargetIP: ip,
    AuditLogCount: rows.length,
    AuditLogs: rows,
    TariLiability: {
      totalUsd: tariTotal,
      formatted: tariFormatted,
      breakdown: tariBreakdown,
      labels: Object.fromEntries(
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
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");

  console.log("");
  console.log(`✅ Evidence bundle written: ${filePath}`);
  console.log(`   TARI™ Liability  : ${tariFormatted} USD`);
  console.log(`   Audit Rows       : ${rows.length}`);
  console.log(`   BTC Block Height : ${btcBlockHeight ?? "unavailable"}`);
  console.log(`   Pulse Hash       : ${pulseHash.slice(0, 32)}…`);
  console.log("⛓️⚓⛓️ Sovereign Evidence Export complete. 🤛🏻");
  console.log("");
}

main().catch((err) => {
  console.error("❌ Sovereign Evidence Exporter error:", err);
  process.exit(1);
});
