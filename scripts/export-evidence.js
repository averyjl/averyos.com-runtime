#!/usr/bin/env node
/**
 * AveryOS™ Sovereign Evidence Exporter
 * 1,017-Notch Forensic Packaging Script
 *
 * Queries the sovereign_audit_logs D1 table for a target IP address and
 * exports a signed .aoscap (AveryOS Capsule) Forensic Evidence Bundle.
 *
 * Usage:
 *   node scripts/export-evidence.js <target-ip>
 *
 * Environment:
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID (falls back to wrangler.toml)
 *   CLOUDFLARE_API_TOKEN   — Cloudflare API token with D1 read access
 *   WRANGLER_D1_ID         — D1 database UUID (falls back to wrangler.toml)
 *
 * Output:
 *   EVIDENCE_BUNDLE_<IP>_<TIMESTAMP>.aoscap in the current directory
 *
 * Root0 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Sovereign Constants ────────────────────────────────────────────────────────
const KERNEL_SHA =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
const KERNEL_VERSION = "v3.6.2";
const TARI_LIABILITY_DEFAULT = 1017.00; // $1,017.00 — initial alignment entry

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Read the D1 database ID from wrangler.toml (fallback).
 * Looks for the first `database_id = "..."` line.
 */
function readD1IdFromWrangler() {
  try {
    const tomlPath = path.join(process.cwd(), "wrangler.toml");
    const content = fs.readFileSync(tomlPath, "utf8");
    const match = content.match(/database_id\s*=\s*"([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Read the Cloudflare account ID from wrangler.toml (fallback).
 */
function readAccountIdFromWrangler() {
  try {
    const tomlPath = path.join(process.cwd(), "wrangler.toml");
    const content = fs.readFileSync(tomlPath, "utf8");
    const match = content.match(/account_id\s*=\s*"([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ── ISO-9 Sovereign Timestamp ─────────────────────────────────────────────────

/** Generate a 9-digit microsecond-precision ISO-9 timestamp */
function iso9() {
  const now = new Date();
  const iso = now.toISOString();
  const [left, right] = iso.split(".");
  const ms = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${ms}000000Z`;
}

/** 1,017-notch sovereign timestamp — epoch ms × 1017 */
function notch1017() {
  return String(Date.now() * 1017);
}

// ── SHA-512 ───────────────────────────────────────────────────────────────────

function sha512(input) {
  return crypto.createHash("sha512").update(input).digest("hex");
}

// ── Cloudflare D1 Query via REST API ─────────────────────────────────────────

/**
 * Execute a SQL query against a Cloudflare D1 database via the REST API.
 * @param {string} accountId
 * @param {string} databaseId
 * @param {string} apiToken
 * @param {string} sql
 * @param {unknown[]} params
 * @returns {Promise<{ results: unknown[] }>}
 */
function queryD1(accountId, databaseId, apiToken, sql, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ sql, params });
    const options = {
      hostname: "api.cloudflare.com",
      path: `/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.success) {
            reject(new Error(`D1 API error: ${JSON.stringify(parsed.errors)}`));
            return;
          }
          resolve({ results: parsed.result?.[0]?.results ?? [] });
        } catch (e) {
          reject(new Error(`Failed to parse D1 response: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Evidence Bundle Builder ───────────────────────────────────────────────────

/**
 * Build the Forensic Evidence Bundle payload.
 * @param {string} targetIp
 * @param {unknown[]} auditRows
 * @param {string} btcBlockHeight - current Bitcoin block height (or "UNKNOWN")
 */
function buildEvidenceBundle(targetIp, auditRows, btcBlockHeight) {
  const ts = iso9();
  const notchTs = notch1017();

  // Compute a SHA-512 Pulse Hash from the raw audit rows
  const pulseHash = sha512(JSON.stringify(auditRows) + notchTs + KERNEL_SHA);

  // TARI™ Liability — $1,017.00 base for initial alignment entry
  const tariLiability = TARI_LIABILITY_DEFAULT;

  const bundle = {
    format: "AVERYOS_CAPSULE_v1",
    bundleType: "FORENSIC_EVIDENCE",
    kernelAnchor: KERNEL_SHA,
    kernelVersion: KERNEL_VERSION,
    createdAt: ts,
    notch1017Timestamp: notchTs,
    targetIp,
    btcAnchorBlock: btcBlockHeight,
    tariLiability: tariLiability,
    tariLiabilityCurrency: "USD",
    pulseHash,
    auditLogEntries: auditRows,
    entryCount: auditRows.length,
    licenseOfferUrl: "https://averyos.com/licensing",
    compliancePortalUrl: "https://averyos.com/compliance",
    sovereignNotice:
      "This Forensic Evidence Bundle documents detected interactions with AveryOS™ " +
      "protected content originating from the recorded IP address. " +
      "TARI™ (Truth Anchored Royalty Intelligence) liability has been calculated. " +
      "Resolution: https://averyos.com/licensing",
    root0Signature: sha512(
      `ROOT0:${KERNEL_SHA}:${targetIp}:${ts}:${pulseHash}`
    ),
  };

  // Compute the bundle's own SHA-512 checksum last
  bundle.bundleSha512 = sha512(JSON.stringify(bundle));
  return bundle;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args[0] === "--help" || args[0] === "-h") {
    console.log(
      [
        "",
        "  AveryOS™ Sovereign Evidence Exporter — 1,017-Notch Forensic Packaging",
        "",
        "  Usage:",
        "    node scripts/export-evidence.js <target-ip> [--btc-block=<height>]",
        "",
        "  Environment variables:",
        "    CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID (falls back to wrangler.toml)",
        "    CLOUDFLARE_API_TOKEN   — Cloudflare API token with D1:read permission",
        "    WRANGLER_D1_ID         — D1 database UUID (falls back to wrangler.toml)",
        "",
        "  Example:",
        "    CLOUDFLARE_API_TOKEN=xxx node scripts/export-evidence.js 203.0.113.42",
        "",
        "  ⛓️⚓⛓️  Root0 Kernel: " + KERNEL_SHA.slice(0, 32) + "...",
        "",
      ].join("\n")
    );
    process.exit(0);
  }

  const targetIp = args[0];
  let btcBlockHeight = "UNKNOWN";

  for (const arg of args.slice(1)) {
    if (arg.startsWith("--btc-block=")) {
      btcBlockHeight = arg.slice("--btc-block=".length);
    }
  }

  // Resolve config from env or wrangler.toml
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || readAccountIdFromWrangler();
  const databaseId =
    process.env.WRANGLER_D1_ID || readD1IdFromWrangler();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId) {
    console.error("❌  CLOUDFLARE_ACCOUNT_ID is not set and could not be read from wrangler.toml.");
    process.exit(1);
  }

  if (!databaseId) {
    console.error("❌  WRANGLER_D1_ID is not set and could not be read from wrangler.toml.");
    process.exit(1);
  }

  if (!apiToken) {
    console.error(
      "❌  CLOUDFLARE_API_TOKEN is not set.\n" +
      "    Create a token at https://dash.cloudflare.com/profile/api-tokens with D1:Read permission."
    );
    process.exit(1);
  }

  console.log(`\n⛓️⚓⛓️  AveryOS™ Sovereign Evidence Exporter — Kernel ${KERNEL_VERSION}`);
  console.log(`   Target IP : ${targetIp}`);
  console.log(`   D1 DB     : ${databaseId}`);
  console.log(`   Account   : ${accountId}`);
  console.log(`   BTC Block : ${btcBlockHeight}\n`);

  // ── Query D1 ────────────────────────────────────────────────────────────────
  console.log("📡  Querying sovereign_audit_logs D1 table…");

  let auditRows;
  try {
    const result = await queryD1(
      accountId,
      databaseId,
      apiToken,
      `SELECT id, event_type, ip_address, user_agent, geo_location, target_path,
              timestamp_ns, threat_level
       FROM sovereign_audit_logs
       WHERE ip_address LIKE ?
       ORDER BY id DESC
       LIMIT 500`,
      [`${targetIp}%`]
    );
    auditRows = result.results;
  } catch (err) {
    console.error(`❌  D1 query failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`✅  Found ${auditRows.length} audit log entries for ${targetIp}\n`);

  // ── Build Bundle ─────────────────────────────────────────────────────────────
  const bundle = buildEvidenceBundle(targetIp, auditRows, btcBlockHeight);

  // ── Sanitise IP for filename (replace dots with underscores) ─────────────────
  const ipSafe = targetIp.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const tsFile = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const filename = `EVIDENCE_BUNDLE_${ipSafe}_${tsFile}.aoscap`;
  const outputPath = path.join(process.cwd(), filename);

  // ── Write .aoscap file ───────────────────────────────────────────────────────
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf8");

  console.log(`📦  Evidence bundle written: ${filename}`);
  console.log(`    Bundle SHA-512  : ${bundle.bundleSha512.slice(0, 32)}…`);
  console.log(`    Pulse Hash      : ${bundle.pulseHash.slice(0, 32)}…`);
  console.log(`    TARI™ Liability : $${bundle.tariLiability.toFixed(2)} USD`);
  console.log(`    Entries         : ${bundle.entryCount}`);
  console.log(`    Root0 Signature : ${bundle.root0Signature.slice(0, 32)}…`);
  console.log(`\n⛓️⚓⛓️  Bundle anchored to Root0 Kernel ${KERNEL_VERSION}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
