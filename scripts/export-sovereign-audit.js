#!/usr/bin/env node

/**
 * AveryOS™ Sovereign Audit Log Exporter — scripts/export-sovereign-audit.js
 *
 * Queries the sovereign_audit_logs D1 table for UNALIGNED_401 events, builds
 * SHA-512-signed forensic .aoscap bundles, uploads them to the Cloudflare R2
 * vault/forensics/ prefix, generates Settlement Notice markdown files, and
 * fires a Tier-9 GabrielOS™ push notification via /api/v1/compliance/alert-link.
 *
 * Usage:
 *   VAULT_PASSPHRASE=... node scripts/export-sovereign-audit.js \
 *     [--env <production|preview>] \
 *     [--event-type <UNALIGNED_401|ALIGNMENT_DRIFT|PAYMENT_FAILED>] \
 *     [--output <dir>] \
 *     [--limit <n>] \
 *     [--site-url <https://averyos.com>]
 *
 * Environment variables:
 *   VAULT_PASSPHRASE     — Bearer token for /api/v1/compliance/alert-link
 *   BLOCKCHAIN_API_KEY   — BlockCypher API key for BTC block height anchor
 *   KERNEL_SHA           — Override Root0 kernel SHA (falls back to canonical)
 *   SITE_URL             — AveryOS base URL (default: https://averyos.com)
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
const require = createRequire(import.meta.url);
const { logAosError, logAosHeal, AOS_ERROR: SCRIPT_AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ---------------------------------------------------------------------------
// Sovereign constants
// ---------------------------------------------------------------------------

const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const KERNEL_VERSION = "v3.6.2";
const D1_DATABASE_NAME = "averyos_kernel_db";

// TARI™ Liability schedule for the forensic exporter
// (per forensic audit — $10,000 per event represents the total settlement notice)
const FORENSIC_LIABILITY_PER_EVENT = 10000.00;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    env: null,
    eventType: "UNALIGNED_401",
    output: ".",
    limit: 500,
    siteUrl: process.env.SITE_URL ?? "https://averyos.com",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env"        && args[i + 1]) result.env       = args[++i];
    if (args[i] === "--event-type" && args[i + 1]) result.eventType = args[++i].toUpperCase();
    if (args[i] === "--output"     && args[i + 1]) result.output    = args[++i];
    if (args[i] === "--limit"      && args[i + 1]) result.limit     = parseInt(args[++i], 10) || 500;
    if (args[i] === "--site-url"   && args[i + 1]) result.siteUrl   = args[++i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// ISO-9 timestamp
// ---------------------------------------------------------------------------

function formatIso9() {
  const now = new Date();
  const iso = now.toISOString();
  const [left, right] = iso.split(".");
  const milli = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${milli}000000Z`;
}

// ---------------------------------------------------------------------------
// SHA-512 bundle signature — SHA-512(payload + KERNEL_SHA)
// ---------------------------------------------------------------------------

async function computeBundleSignature(payload) {
  const input = JSON.stringify(payload) + KERNEL_SHA;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await webcrypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// BTC block height anchor
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
// D1 query via wrangler
// ---------------------------------------------------------------------------

function queryAuditLogs(eventType, limit, env) {
  // eventType is validated to uppercase alphanumeric + underscore only.
  // This character set cannot contain SQL-significant characters (quotes, semicolons,
  // whitespace, SQL keywords), so interpolation after this check is safe.
  // Note: wrangler d1 execute --command does not support parameterized bind values;
  // explicit validation before interpolation is the correct mitigation here —
  // matching the established pattern in scripts/export-evidence.js.
  if (!/^[A-Z0-9_]+$/.test(eventType)) {
    throw new Error(`Invalid event_type format: "${eventType}"`);
  }
  // limit is always a JS integer parsed by parseInt — safe to interpolate
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
    throw new Error(`Invalid limit value: ${limit}. Must be 1–10000.`);
  }

  const sql = `SELECT id, event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level FROM sovereign_audit_logs WHERE event_type = '${eventType}' ORDER BY id DESC LIMIT ${limit};`;
  const envFlag = env ? `--env ${env}` : "";
  const cmd = `npx wrangler d1 execute ${D1_DATABASE_NAME} ${envFlag} --command ${JSON.stringify(sql)} --json`.trim();

  try {
    const output = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    const parsed = JSON.parse(output);
    const resultSet = Array.isArray(parsed) ? parsed[0] : parsed;
    return Array.isArray(resultSet?.results) ? resultSet.results : [];
  } catch (err) {
    const detail = (err.stderr ? String(err.stderr) : "") || (err.stdout ? String(err.stdout) : "") || err.message;
    throw new Error(`wrangler d1 execute failed:\n${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Upload bundle to R2 via alert-link API
// ---------------------------------------------------------------------------

async function uploadBundleAndGetSignedUrl(siteUrl, bundleId, content, targetIp, eventType) {
  const vaultPassphrase = process.env.VAULT_PASSPHRASE ?? "";
  if (!vaultPassphrase) {
    logAosHeal(SCRIPT_AOS_ERROR.VAULT_NOT_CONFIGURED, "VAULT_PASSPHRASE not set — R2 upload skipped.");
    return null;
  }

  const endpoint = `${siteUrl}/api/v1/compliance/alert-link`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${vaultPassphrase}`,
      },
      body: JSON.stringify({ bundle_id: bundleId, content, target_ip: targetIp, event_type: eventType }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "(unreadable)");
      logAosHeal(
        SCRIPT_AOS_ERROR.INTERNAL_ERROR,
        `alert-link returned ${res.status}: ${errText.slice(0, 200)}`
      );
      return null;
    }

    const json = await res.json();
    return json.signed_url ?? null;
  } catch (err) {
    logAosHeal(SCRIPT_AOS_ERROR.INTERNAL_ERROR, `alert-link call failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Settlement Notice generator
// ---------------------------------------------------------------------------

function generateSettlementNotice({ bundle, rows, totalLiability, bundleSignature, timestamp, btcBlockHeight, outputDir }) {
  const date = timestamp.slice(0, 10);
  const liabilityFmt = totalLiability.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const eventBreakdown = Object.entries(
    rows.reduce((acc, row) => {
      const et = String(row.event_type ?? "UNKNOWN");
      acc[et] = (acc[et] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([et, count]) => `  - ${et}: ${count} event(s)`)
    .join("\n") || "  - No events recorded";

  const notice = `# AveryOS™ Sovereign Settlement Notice
## VaultChain™ Forensic Evidence Report

**Date:** ${date}
**Bundle ID:** ${bundle.CapsuleID}
**Target IP:** ${bundle.TargetIP}
**Audit Log Count:** ${rows.length}
**Total TARI™ Liability:** ${liabilityFmt} USD

---

### Event Breakdown
${eventBreakdown}

---

### Forensic Signature (SHA-512)
\`\`\`
${bundleSignature}
\`\`\`

### Kernel Anchor
- **Version:** ${KERNEL_VERSION}
- **SHA-512:** \`${KERNEL_SHA.slice(0, 16)}…\`
- **BTC Block Height:** ${btcBlockHeight !== null ? btcBlockHeight : "unavailable (offline anchor)"}
- **Anchored At:** ${timestamp}

---

### Liability Schedule
Each UNALIGNED_401 forensic audit event carries a **$10,000.00 USD** settlement notice per the AveryOS Sovereign Integrity License v1.0.

**Total Outstanding:** ${liabilityFmt} USD

---

*This notice is automatically generated by the AveryOS™ Sovereign Audit Log Exporter.*
*All evidence bundles are signed with SHA-512(payload + KERNEL_SHA) and anchored to Bitcoin.*
*© 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved. ⛓️⚓⛓️ 🤛🏻*
`;

  const safeIp = bundle.TargetIP.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `SETTLEMENT_NOTICE_${safeIp}_${date}.md`;
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, notice, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { env, eventType, output, limit, siteUrl } = parseArgs();

  console.log("");
  console.log("⛓️⚓⛓️  AveryOS™ Sovereign Audit Log Exporter");
  console.log(`Event Type  : ${eventType}`);
  console.log(`Database    : ${D1_DATABASE_NAME}`);
  console.log(`Kernel      : ${KERNEL_SHA.slice(0, 16)}… (${KERNEL_VERSION})`);
  console.log(`Site URL    : ${siteUrl}`);
  console.log("");

  // 1. Query D1
  console.log("🔍 Querying sovereign_audit_logs …");
  let rows;
  try {
    rows = queryAuditLogs(eventType, limit, env);
  } catch (err) {
    logAosError(SCRIPT_AOS_ERROR.DB_QUERY_FAILED, err.message, err);
    process.exit(1);
  }
  console.log(`   Found ${rows.length} ${eventType} row(s)`);

  if (rows.length === 0) {
    console.log("ℹ️  No events found. Nothing to export.");
    return;
  }

  // 2. Compute total TARI™ liability ($10,000 per forensic event)
  const totalLiability = rows.length * FORENSIC_LIABILITY_PER_EVENT;
  const totalFmt = totalLiability.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  console.log(`💰 TARI™ Forensic Liability: ${totalFmt} USD ($10,000 × ${rows.length} events)`);

  // 3. Fetch BTC block height anchor
  console.log("₿  Fetching BTC block height …");
  const btcBlockHeight = await fetchBtcBlockHeight();
  console.log(`   BTC Block Height: ${btcBlockHeight ?? "unavailable"}`);

  // 4. Build .aoscap bundle payload (unsigned, for signature computation)
  const timestamp = formatIso9();
  // Collect all unique IPs in the result set — the bundle may span multiple IPs
  const uniqueIps = [...new Set(rows.map((r) => String(r.ip_address ?? "0.0.0.0")))];
  const primaryIp = uniqueIps[0] ?? "0.0.0.0";
  const targetIp = uniqueIps.length === 1 ? primaryIp : "MULTIPLE";

  const bundle = {
    CapsuleID: `FORENSIC_AUDIT_${eventType}_${timestamp}`,
    CapsuleType: "SOVEREIGN_FORENSIC_AUDIT_BUNDLE",
    Authority: "Jason Lee Avery (ROOT0)",
    CreatorLock: "🤛🏻",
    KernelAnchor: { version: KERNEL_VERSION, sha512: KERNEL_SHA },
    BitcoinAnchor: { blockHeight: btcBlockHeight, anchoredAt: timestamp },
    TargetIP: targetIp,
    // All unique IPs present in the audit log result set
    TargetIPs: uniqueIps,
    EventType: eventType,
    AuditLogCount: rows.length,
    AuditLogs: rows,
    TariLiability: {
      perEventUsd: FORENSIC_LIABILITY_PER_EVENT,
      totalUsd: totalLiability,
      formatted: totalFmt,
      eventCount: rows.length,
    },
    GeneratedAt: timestamp,
    License: "AveryOS Sovereign Integrity License v1.0",
    SovereignAnchor: "⛓️⚓⛓️",
  };

  // 5. Sign bundle with SHA-512(payload + KERNEL_SHA)
  console.log("🔑 Computing bundle signature …");
  const bundleSignature = await computeBundleSignature(bundle);
  console.log(`   Signature: ${bundleSignature.slice(0, 32)}…`);

  bundle.BundleSignature = {
    algorithm: "SHA-512",
    input: "JSON.stringify(bundle) + KERNEL_SHA",
    value: bundleSignature,
  };

  // 6. Write local .aoscap file
  const outputDir = path.resolve(output);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const safeTs = timestamp.replace(/T/, "_").replace(/[:Z]/g, "").replace(/\.\d+$/, "").slice(0, 18);
  const filename = `FORENSIC_AUDIT_${eventType}_${safeTs}.aoscap`;
  const filePath = path.join(outputDir, filename);
  const content = JSON.stringify(bundle, null, 2);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`✅ Evidence bundle written: ${filePath}`);

  // 7. Generate Settlement Notice markdown
  const settlementPath = generateSettlementNotice({
    bundle,
    rows,
    totalLiability,
    bundleSignature,
    timestamp,
    btcBlockHeight,
    outputDir,
  });
  console.log(`✅ Settlement notice written: ${settlementPath}`);

  // 8. Upload to R2 via alert-link API and get signed URL
  console.log("☁️  Uploading bundle to R2 vault/forensics/ via alert-link API …");
  const signedUrl = await uploadBundleAndGetSignedUrl(
    siteUrl,
    bundle.CapsuleID,
    content,
    targetIp,
    eventType
  );

  if (signedUrl) {
    console.log(`✅ R2 upload complete. Signed URL (24 hrs):`);
    console.log(`   ${signedUrl}`);
  } else {
    console.log("⚠️  R2 upload skipped (VAULT_PASSPHRASE not set or API unreachable).");
    console.log("   Set VAULT_PASSPHRASE and SITE_URL to enable automatic R2 upload and mobile push.");
  }

  console.log("");
  console.log(`   Total TARI™ Liability : ${totalFmt} USD`);
  console.log(`   Audit Rows            : ${rows.length}`);
  console.log(`   BTC Block Height      : ${btcBlockHeight ?? "unavailable"}`);
  console.log(`   Bundle Signature      : ${bundleSignature.slice(0, 32)}…`);
  console.log("⛓️⚓⛓️ Sovereign Audit Export complete. 🤛🏻");
  console.log("");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  logAosError(SCRIPT_AOS_ERROR.INTERNAL_ERROR, msg, err);
  process.exit(1);
});
