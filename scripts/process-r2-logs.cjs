#!/usr/bin/env node
/**
 * scripts/process-r2-logs.cjs
 * AveryOS™ R2 Log Processor — Sovereign Perimeter Intelligence
 *
 * PURPOSE:
 *   Polls the R2 log-push bucket (cloudflare-managed-42f4b874) at the path
 *   averyos_log_push/, parses Cloudflare logpush JSON entries, extracts
 *   RayIDs, IPs, ASN data, and paths, then pipes every unique IP/ASN found
 *   probing /.env or /hooks directly into the D1 sovereign_audit_logs table
 *   for TARI™ invoicing.
 *
 * ALM HANDSHAKE:
 *   When the local AveryOS™ ALM bridge (averyos-alm) is running, the script
 *   prioritises it for forensic log parsing.  The ALM bridge caches log data
 *   locally, deduplicates across runs, and exposes a REST API at:
 *     ALM_ENDPOINT (default: http://localhost:4017)
 *   If the ALM bridge is unavailable, the script falls back to direct R2 API
 *   access automatically — no manual intervention required.
 *
 * USAGE:
 *   node scripts/process-r2-logs.cjs
 *
 * ENVIRONMENT VARIABLES:
 *   CLOUDFLARE_API_TOKEN  — Cloudflare API token (Workers R2 read + D1 write)
 *   CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID
 *   R2_BUCKET_NAME        — R2 bucket name (default: cloudflare-managed-42f4b874)
 *   R2_LOG_PREFIX         — R2 object key prefix (default: averyos_log_push/)
 *   D1_DATABASE_ID        — D1 database ID for averyos_kernel_db
 *   ALM_ENDPOINT          — averyos-alm local bridge URL (default: http://localhost:4017)
 *   DRY_RUN               — Set to "true" to print results without writing to D1
 *
 * TARI™ BILLING:
 *   Any IP probing /.env or /hooks is logged with event_type='TARI_PROBE'
 *   and threat_level=9, making it immediately visible in the TARI™ Revenue
 *   Dashboard and eligible for automated Alignment Invoice generation.
 *
 * Author: Jason Lee Avery (ROOT0)
 * Anchor: cf83e135...927da3e ⛓️⚓⛓️
 */

"use strict";
const { logAosError, logAosHeal } = require('./sovereignErrorLogger.cjs');

const CF_API      = "https://api.cloudflare.com/client/v4";
const ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN  ?? "";
const BUCKET_NAME = process.env.R2_BUCKET_NAME        ?? "cloudflare-managed-42f4b874";
const LOG_PREFIX  = process.env.R2_LOG_PREFIX         ?? "averyos_log_push/";
const DB_ID       = process.env.D1_DATABASE_ID        ?? "";
const DRY_RUN     = process.env.DRY_RUN === "true";

// ── ALM Handshake — averyos-alm local bridge ─────────────────────────────────
// The ALM bridge is a local Node.js service that caches R2 log data, provides
// deduplication across runs, and exposes a REST API for forensic log parsing.
// When available, it is always preferred over direct Cloudflare API calls.
const ALM_ENDPOINT   = process.env.ALM_ENDPOINT ?? "http://localhost:4017";
const ALM_TIMEOUT_MS = 3000; // 3s — fast fail so R2 fallback is seamless

/**
 * Try to connect to the local averyos-alm bridge and fetch pre-parsed log entries.
 * Returns parsed entries array on success, or null if the bridge is unavailable.
 */
async function tryAlmHandshake() {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), ALM_TIMEOUT_MS);
    const res = await fetch(`${ALM_ENDPOINT}/api/logs/pending`, {
      headers: { "x-aos-kernel": "cf83", "x-aos-source": "process-r2-logs" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return null;

    const data = await res.json();
    const entries = data.entries ?? data.logs ?? [];

    if (entries.length > 0) {
      console.log(`🔗 ALM Handshake: averyos-alm bridge active at ${ALM_ENDPOINT}`);
      console.log(`   Received ${entries.length} pre-parsed log entry(ies) from local cache.`);

      // Acknowledge entries so the ALM bridge marks them as processed
      await fetch(`${ALM_ENDPOINT}/api/logs/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-aos-kernel": "cf83" },
        body: JSON.stringify({ count: entries.length }),
      }).catch(() => {});
    } else {
      console.log(`🔗 ALM Handshake: bridge online, no pending entries.`);
    }

    return entries;
  } catch {
    // Bridge not running — fall back to direct R2 API access
    return null;
  }
}

// Paths that indicate probing / attack attempts
const PROBE_PATHS = new Set(["/.env", "/hooks", "/.git", "/wp-admin", "/xmlrpc.php"]);

/** Determines whether a log entry's path indicates a probe/attack attempt. */
function isProbe(entry) {
  const p = entry.path ?? "";
  return PROBE_PATHS.has(p) || p.includes("/.env") || p.includes("/hooks");
}

// ── Validation ────────────────────────────────────────────────────────────────
if (!ACCOUNT_ID || !API_TOKEN) {
  logAosError("process-r2-logs", "MISSING_ENV",
    "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");
  process.exit(1);
}
if (!DB_ID) {
  logAosError("process-r2-logs", "MISSING_ENV",
    "D1_DATABASE_ID is required to write probe data to D1.");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** List R2 object keys under LOG_PREFIX */
async function listR2Objects(cursor) {
  const qs = new URLSearchParams({ prefix: LOG_PREFIX, limit: "100" });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(
    `${CF_API}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/objects?${qs}`,
    { headers: { Authorization: `Bearer ${API_TOKEN}` } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`R2 list failed (${res.status}): ${body}`);
  }
  return res.json();
}

/** Download an R2 object as text */
async function getR2Object(key) {
  const res = await fetch(
    `${CF_API}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/objects/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${API_TOKEN}` } }
  );
  if (!res.ok) throw new Error(`R2 get failed (${res.status}) for key: ${key}`);
  return res.text();
}

/** Write a sovereign_audit_log row via D1 HTTP API (parameterized) */
async function insertD1AuditLog(entry) {
  if (DRY_RUN) {
    console.log("[DRY_RUN] Would insert:", JSON.stringify(entry));
    return;
  }
  const sql =
    `INSERT INTO sovereign_audit_logs ` +
    `(event_type, ip_address, user_agent, geo_location, target_path, timestamp_ns, threat_level) ` +
    `VALUES (?, ?, ?, ?, ?, ?, ?)`;

  const res = await fetch(
    `${CF_API}/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params: [
          entry.event_type,
          entry.ip,
          entry.ua,
          entry.asn,
          entry.path,
          entry.timestamp_ns,
          entry.threat_level,
        ],
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`D1 insert failed (${res.status}): ${body}`);
  }
}

/**
 * Parse a Cloudflare logpush NDJSON payload.
 * Each line is a JSON object with fields like:
 *   ClientIP, ClientRequestURI, RayID, ClientASN, ClientCountry,
 *   EdgeStartTimestamp, EdgeResponseStatus, ClientRequestUserAgent
 */
function parseLogLines(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      entries.push({
        rayId:       obj.RayID       ?? obj.cf_ray       ?? "UNKNOWN",
        ip:          obj.ClientIP    ?? obj.client_ip    ?? "UNKNOWN",
        ua:          (obj.ClientRequestUserAgent ?? "").replace(/'/g, "''"),
        path:        obj.ClientRequestURI    ?? obj.uri  ?? "/",
        asn:         String(obj.ClientASN ?? obj.client_asn ?? ""),
        country:     obj.ClientCountry ?? "",
        status:      obj.EdgeResponseStatus ?? 0,
        timestampNs: (obj.EdgeStartTimestamp
          ? String(obj.EdgeStartTimestamp) + "000"
          : String(Date.now()) + "000000"),
      });
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("⛓️⚓⛓️  AveryOS™ R2 Log Processor — starting");
  console.log(`   Bucket : ${BUCKET_NAME}`);
  console.log(`   Prefix : ${LOG_PREFIX}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   ALM    : ${ALM_ENDPOINT}`);
  console.log("");

  let processed  = 0;
  let probeCount = 0;
  const seen     = new Set();  // deduplicate IP+path combos

  // ── Step 1: Try ALM Handshake — prefer local averyos-alm bridge ──────────
  console.log("🔗 Checking for local averyos-alm bridge...");
  const almEntries = await tryAlmHandshake();

  if (almEntries !== null) {
    // ALM bridge is active — process its pre-parsed entries directly
    console.log("");
    if (almEntries.length > 0) {
      processed += almEntries.length;
      for (const entry of almEntries) {
        const isProbeEntry = isProbe(entry);

        if (!isProbeEntry) continue;

        const dedupKey = `${entry.ip}||${entry.path}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        probeCount++;
        console.log(`  🚨 [ALM] PROBE [${entry.ip}] ASN:${entry.asn ?? ""} → ${entry.path}  RayID:${entry.rayId ?? ""}`);

        try {
          await insertD1AuditLog({
            event_type:   "TARI_PROBE",
            ip:           entry.ip ?? "UNKNOWN",
            ua:           (entry.ua ?? "").replace(/'/g, "''"),
            asn:          entry.country || entry.asn || "",
            path:         entry.path ?? "/",
            timestamp_ns: entry.timestampNs ?? (String(Date.now()) + "000000"),
            threat_level: 9,
          });
          logAosHeal("process-r2-logs", `[ALM] Logged TARI_PROBE for ${entry.ip} → ${entry.path}`);
        } catch (err) {
          logAosError("process-r2-logs", "D1_INSERT_FAIL",
            `[ALM] IP:${entry.ip} path:${entry.path} — ${err.message}`);
        }
      }
    }
  } else {
    // ── Step 2: Fallback — direct R2 API pagination ───────────────────────
    console.log("   (ALM bridge unavailable — falling back to direct R2 API access)");
    console.log("");

    let cursor = undefined;

    do {
      let listing;
      try {
        listing = await listR2Objects(cursor);
      } catch (err) {
        logAosError("process-r2-logs", "R2_LIST_FAIL", err.message);
        console.error("❌ Failed to list R2 objects:", err.message);
        process.exit(1);
      }

      const objects = listing.result?.objects ?? [];
      cursor = listing.result?.cursor;

      console.log(`📦 Processing ${objects.length} log object(s)…`);

      for (const obj of objects) {
        let text;
        try {
          text = await getR2Object(obj.key);
        } catch (err) {
          logAosError("process-r2-logs", "R2_GET_FAIL", `Key: ${obj.key} — ${err.message}`);
          console.warn(`  ⚠️  Skipping ${obj.key}: ${err.message}`);
          continue;
        }

        const entries = parseLogLines(text);
        processed += entries.length;

        for (const entry of entries) {
          if (!isProbe(entry)) continue;

          const dedupKey = `${entry.ip}||${entry.path}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          probeCount++;
          console.log(`  🚨 PROBE [${entry.ip}] ASN:${entry.asn} → ${entry.path}  RayID:${entry.rayId}`);

          try {
            await insertD1AuditLog({
              event_type:   "TARI_PROBE",
              ip:           entry.ip,
              ua:           entry.ua,
              asn:          entry.country || entry.asn,
              path:         entry.path,
              timestamp_ns: entry.timestampNs,
              threat_level: 9,
            });
            logAosHeal("process-r2-logs", `Logged TARI_PROBE for ${entry.ip} → ${entry.path}`);
          } catch (err) {
            logAosError("process-r2-logs", "D1_INSERT_FAIL",
              `IP:${entry.ip} path:${entry.path} — ${err.message}`);
            console.warn(`  ⚠️  D1 insert failed for ${entry.ip}: ${err.message}`);
          }
        }
      }
    } while (cursor);
  }

  console.log("");
  console.log(`✅ R2 log processing complete.`);
  console.log(`   Total log entries parsed : ${processed}`);
  console.log(`   Unique probe IPs logged  : ${probeCount}`);
  if (DRY_RUN) {
    console.log("   ⚠️  DRY RUN — no D1 writes were performed.");
  }
  console.log("⛓️⚓⛓️");
}

main().catch(err => {
  logAosError("process-r2-logs", "FATAL", err.message ?? String(err));
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
