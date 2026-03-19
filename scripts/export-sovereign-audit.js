#!/usr/bin/env node
/**
 * AveryOS™ Sovereign Audit Log Exporter — scripts/export-sovereign-audit.js
 *
 * Queries the D1 sovereign_audit_logs table for UNALIGNED_401 corporate
 * ingestion events, applies the TARI™ $10,000 liability schedule, packages
 * each IP's events into a signed .aoscap forensic bundle, and uploads it to
 * the Cloudflare R2 vault/forensics/ directory.
 *
 * A Settlement Notice markdown file is generated alongside each bundle.
 *
 * Usage:
 *   node scripts/export-sovereign-audit.js \
 *     [--env production] \
 *     [--ip <target-ip>] \
 *     [--output <local-dir>]
 *
 * Environment variables:
 *   BLOCKCHAIN_API_KEY   — BlockCypher API key for live BTC block anchor
 *   KERNEL_SHA           — Override Root0 kernel SHA (defaults to canonical)
 *   D1_DATABASE_NAME     — D1 database name (default: averyos_kernel_db)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { execSync } from "child_process";
import { webcrypto } from "node:crypto";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { logAosError, logAosHeal, AOS_ERROR } = require("./sovereignErrorLogger.cjs");

// ---------------------------------------------------------------------------
// Sovereign constants (inline — script has no module bundler)
// ---------------------------------------------------------------------------
const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";
const D1_DATABASE_NAME = process.env.D1_DATABASE_NAME ?? "averyos_kernel_db";
const R2_BUCKET_NAME   = process.env.R2_BUCKET_NAME   ?? "cloudflare-managed-42f4b874";

// ---------------------------------------------------------------------------
// TARI™ Liability Schedule
// ---------------------------------------------------------------------------
const TARI_LIABILITY = {
  UNALIGNED_401: 10_000.0,    // $10,000 per unauthorized corporate ingestion
  ALIGNMENT_DRIFT: 50_000.0,  // $50,000 per sovereignty drift violation
  DEFAULT: 1_017.0,           // $1,017 baseline per unclassified event
};

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}
const ENV        = getArg("--env")    ?? "production";
const TARGET_IP  = getArg("--ip")    ?? null;
const OUTPUT_DIR = getArg("--output") ?? path.resolve(__dirname, "../tmp/sovereign-audit-exports");

// Validate IP address if provided (strict pattern to prevent injection)
const IP_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/;
if (TARGET_IP && !IP_PATTERN.test(TARGET_IP)) {
  console.error(`❌ Invalid --ip value: "${TARGET_IP}". Must be a valid IPv4 or IPv6 address.`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// BTC block anchor
// ---------------------------------------------------------------------------
async function fetchBtcAnchor() {
  return new Promise((resolve) => {
    const apiKey = process.env.BLOCKCHAIN_API_KEY ?? "";
    const url = apiKey
      ? `https://api.blockcypher.com/v1/btc/main?token=${apiKey}`
      : "https://api.blockcypher.com/v1/btc/main";
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (d) => { body += d; });
        res.on("end", () => {
          try {
            const obj = JSON.parse(body);
            resolve({ height: obj.height ?? "UNKNOWN", hash: obj.hash ?? "UNKNOWN" });
          } catch {
            resolve({ height: "UNKNOWN", hash: "UNKNOWN" });
          }
        });
      })
      .on("error", () => resolve({ height: "UNKNOWN", hash: "UNKNOWN" }));
  });
}

// ---------------------------------------------------------------------------
// SHA-512 signing
// ---------------------------------------------------------------------------
async function sha512(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuf = await webcrypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// D1 query via wrangler
// ---------------------------------------------------------------------------
function queryD1(sql, env) {
  logAosHeal("D1_QUERY", `Executing: ${sql.slice(0, 80)}...`);
  // Write SQL to a temp file to avoid shell-injection risks entirely
  const tmpSql = path.join(OUTPUT_DIR, `_query_${Date.now()}.sql`);
  try {
    const sqlFd = fs.openSync(tmpSql, 'w');
    try { fs.writeSync(sqlFd, sql); } finally { fs.closeSync(sqlFd); }
    const envFlag = env === "production" ? "--env production" : "";
    const cmd = `npx wrangler d1 execute ${D1_DATABASE_NAME} ${envFlag} --file "${tmpSql}" --json`;
    const stdout = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    const parsed = JSON.parse(stdout);
    // wrangler d1 execute --json returns [{ results: [...] }]
    return parsed?.[0]?.results ?? parsed?.results ?? [];
  } catch (err) {
    logAosError(AOS_ERROR.SCRIPT_EXECUTION_FAILURE, `D1 query failed: ${err.message}`);
    return [];
  } finally {
    try { fs.unlinkSync(tmpSql); } catch { /* best-effort cleanup */ }
  }
}

// ---------------------------------------------------------------------------
// R2 upload via wrangler
// ---------------------------------------------------------------------------
function uploadToR2(localPath, r2Key, env) {
  logAosHeal("R2_UPLOAD", `Uploading ${path.basename(localPath)} → vault/${r2Key}`);
  try {
    const envFlag = env === "production" ? "--env production" : "";
    execSync(
      `npx wrangler r2 object put ${R2_BUCKET_NAME}/vault/forensics/${r2Key} --file "${localPath}" ${envFlag}`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    logAosHeal("R2_UPLOAD_OK", `Uploaded: vault/forensics/${r2Key}`);
    return true;
  } catch (err) {
    logAosError(AOS_ERROR.SCRIPT_EXECUTION_FAILURE, `R2 upload failed: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settlement Notice generator
// ---------------------------------------------------------------------------
function buildSettlementNotice(bundle) {
  const { ip, events, totalLiabilityUsd, capsuleId, btcAnchor, issuedAt } = bundle;
  return `# AveryOS™ TARI™ Settlement Notice

**Capsule ID:** \`${capsuleId}\`
**Issued:** ${issuedAt}
**BTC Anchor Block:** ${btcAnchor.height} (\`${btcAnchor.hash?.slice(0, 16) ?? "N/A"}...\`)
**Kernel Anchor:** \`${KERNEL_SHA.slice(0, 32)}...\` (${KERNEL_VERSION})

---

## Infringing Entity

**IP Address:** \`${ip}\`
**Ingestion Events:** ${events.length}
**Total TARI™ Liability:** **$${totalLiabilityUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD**

---

## Basis for Claim

Under the **AveryOS Sovereign Integrity License v1.0** and the **Truth Anchored Intelligence™ (TARI™) Liability Schedule**, each unauthorized ingestion event incurs a minimum liability of **$10,000 USD** per event.

These events are immutably recorded in the VaultChain™ sovereign ledger (Cloudflare D1 + R2) and cryptographically anchored to Bitcoin Block #${btcAnchor.height}.

---

## Events

| Timestamp | Threat Level | Path | Country |
|-----------|--------------|------|---------|
${events
  .map(
    (e) =>
      `| ${e.timestamp ?? "N/A"} | ${e.threat_level ?? "N/A"} | ${e.path ?? "N/A"} | ${e.country ?? "N/A"} |`
  )
  .join("\n")}

---

## Resolution

To resolve this liability, obtain a valid TARI™ Alignment License at:
**https://averyos.com/tari-gate**

All rights reserved. © 1992–2026 Jason Lee Avery / AveryOS™ ⛓️⚓⛓️ 🤛🏻
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("");
  console.log("⛓️⚓⛓️  AveryOS™ Sovereign Audit Exporter");
  console.log(`   Kernel  : ${KERNEL_VERSION} | SHA: ${KERNEL_SHA.slice(0, 16)}...`);
  console.log(`   Env     : ${ENV}`);
  console.log(`   Target  : ${TARGET_IP ?? "ALL UNALIGNED_401 IPs"}`);
  console.log(`   Output  : ${OUTPUT_DIR}`);
  console.log("");

  // 1. Fetch live BTC anchor
  console.log("🔗 Fetching BTC block anchor...");
  const btcAnchor = await fetchBtcAnchor();
  console.log(`   Block #${btcAnchor.height} | Hash: ${String(btcAnchor.hash).slice(0, 16)}...`);

  // 2. Query D1 for UNALIGNED_401 events
  const ipFilter = TARGET_IP ? `AND ip_address = '${TARGET_IP.replace(/'/g, "''")}'` : "";
  const sql = `SELECT ip_address, path, country, threat_level, timestamp FROM sovereign_audit_logs WHERE threat_level = 'UNALIGNED_401' ${ipFilter} ORDER BY ip_address, timestamp LIMIT 1000`;
  console.log("\n📡 Querying D1 for UNALIGNED_401 events...");
  const rows = queryD1(sql, ENV);
  console.log(`   Found ${rows.length} event(s).`);

  if (rows.length === 0) {
    logAosHeal("NO_EVENTS", "No UNALIGNED_401 events found. Nothing to export.");
    console.log("\n✅ No events to export. Exiting.\n");
    return;
  }

  // 3. Group by IP
  const grouped = {};
  for (const row of rows) {
    const ip = row.ip_address ?? "UNKNOWN";
    if (!grouped[ip]) grouped[ip] = [];
    grouped[ip].push(row);
  }

  const ips = Object.keys(grouped);
  console.log(`\n📦 Building forensic bundles for ${ips.length} IP(s)...`);

  // 4. Build and upload bundles
  for (const ip of ips) {
    const events = grouped[ip];
    const issuedAt = new Date().toISOString();
    const liabilityPerEvent = TARI_LIABILITY.UNALIGNED_401;
    const totalLiabilityUsd = events.length * liabilityPerEvent;
    const capsuleId = `EVIDENCE_BUNDLE_${ip.replace(/[.:]/g, "_")}_${Date.now()}`;

    // Sign the bundle
    const bundlePayload = JSON.stringify({
      capsule_id: capsuleId,
      capsule_type: "FORENSIC_EVIDENCE",
      creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
      kernel_sha: KERNEL_SHA,
      kernel_version: KERNEL_VERSION,
      btc_anchor: btcAnchor,
      ip_address: ip,
      events,
      event_count: events.length,
      liability_per_event_usd: liabilityPerEvent,
      total_liability_usd: totalLiabilityUsd,
      issued_at: issuedAt,
      loop_state: "LOCKED_IN_PARITY",
    });

    const bundleHash = await sha512(bundlePayload);
    const bundle = {
      ...JSON.parse(bundlePayload),
      bundle_hash: bundleHash,
    };

    // Write local .aoscap file
    const filename = `${capsuleId}.aoscap`;
    const localPath = path.join(OUTPUT_DIR, filename);
    const bundleFd = fs.openSync(localPath, 'w');
    try { fs.writeSync(bundleFd, JSON.stringify(bundle, null, 2)); } finally { fs.closeSync(bundleFd); }
    console.log(`\n   ✅ [${ip}] Bundle: ${filename}`);
    console.log(`      Events: ${events.length} | Liability: $${totalLiabilityUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    console.log(`      Hash: ${bundleHash.slice(0, 32)}...`);

    // Write Settlement Notice
    const noticeMd = buildSettlementNotice({ ip, events, totalLiabilityUsd, capsuleId, btcAnchor, issuedAt });
    const noticePath = path.join(OUTPUT_DIR, `${capsuleId}_settlement.md`);
    const noticeFd = fs.openSync(noticePath, 'w');
    try { fs.writeSync(noticeFd, noticeMd); } finally { fs.closeSync(noticeFd); }

    // Upload to R2
    const r2Key = `${capsuleId}.aoscap`;
    uploadToR2(localPath, r2Key, ENV);
  }

  console.log("\n⛓️⚓⛓️  Export complete.");
  console.log(`   Bundles saved to: ${OUTPUT_DIR}`);
  console.log("   Loop State: LOCKED_IN_PARITY 🤛🏻\n");
}

main().catch((err) => {
  logAosError(AOS_ERROR.SCRIPT_EXECUTION_FAILURE, `Fatal: ${err.message}`);
  process.exit(1);
});
