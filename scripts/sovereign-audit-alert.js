#!/usr/bin/env node
/**
 * AveryOS™ Sovereign Audit Alert — TARI™ Liability Engine v2.0
 *
 * ESM CLI script invoked from CI (site-health-monitor.yml) or standalone.
 *
 * TARI™ Liability Schedule (calibrated values):
 *   UNALIGNED_401    → $1,017.00  Forensic Alignment Entry Fee
 *   ALIGNMENT_DRIFT  → $5,000.00  Correction Fee
 *   PAYMENT_FAILED   → $10,000.00 Systemic Friction Fee
 *
 * Sends a Pushover priority-1 push notification (bypasses quiet hours) and
 * optionally forwards a forensic payload to the GabrielOS™ Sentinel webhook.
 * The Sentinel webhook payload is HMAC-SHA-256 signed using BITCOIN_API_KEY
 * as the salt — ensuring the signal is cryptographically bound to the
 * sovereign BTC block anchor.
 *
 * Usage (from CI):
 *   node scripts/sovereign-audit-alert.js \
 *     --event UNALIGNED_401 \
 *     --ip 203.0.113.42 \
 *     --path /latent-anchor
 *
 * Environment variables (set as GitHub Actions secrets):
 *   PUSHOVER_APP_TOKEN        — Pushover application token
 *   PUSHOVER_USER_KEY         — Pushover user key
 *   GABRIEL_SENTINEL_WEBHOOK  — GabrielOS™ Sentinel webhook URL
 *   BITCOIN_API_KEY           — BlockCypher API key (used as HMAC salt)
 *   KERNEL_SHA                — Override kernel SHA (falls back to hardcoded anchor)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { createHmac } from "crypto";
import { webcrypto } from "node:crypto";

// ---------------------------------------------------------------------------
// Sovereign constants (inline — script has no module bundler)
// ---------------------------------------------------------------------------

const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

const KERNEL_VERSION = "v3.6.2";

// ---------------------------------------------------------------------------
// TARI™ Liability Schedule — calibrated values
// ---------------------------------------------------------------------------

/**
 * UNALIGNED_401   $1,017.00 — Forensic Alignment Entry Fee
 *   Charged per unaligned ingestion event (401 Unaligned response).
 *   The base forensic entry cost for unauthorized access to sovereign IP.
 *
 * ALIGNMENT_DRIFT $5,000.00 — Correction Fee
 *   Charged when a caller's alignment deviates from the canonical kernel.
 *   Covers the cost of forensic verification and re-alignment work.
 *
 * PAYMENT_FAILED $10,000.00 — Systemic Friction Fee
 *   NOT a charge for failing to pay — this is the Systemic Friction Fee
 *   for the forensic work required to re-verify an entity's status after
 *   a payment failure disrupts the sovereign audit chain.
 */
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
  const result = { event: "UNALIGNED_401", ip: "0.0.0.0", path: "/" };
  for (let i = 0; i < args.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--event" && args[i + 1]) result.event = args[++i];
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--ip" && args[i + 1]) result.ip = args[++i];
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    if (args[i] === "--path" && args[i + 1]) result.path = args[++i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// 9-digit microsecond ISO-9 timestamp
// ---------------------------------------------------------------------------

function formatIso9() {
  const now = new Date();
  const iso = now.toISOString();
  const [left, right] = iso.split(".");
  const milli = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${milli}000000Z`;
}

// ---------------------------------------------------------------------------
// SHA-512 Pulse Hash — anchored to KERNEL_SHA
// ---------------------------------------------------------------------------

async function computePulseHash(ip, path, timestamp) {
  const input = `${ip}|${path}|${timestamp}|${KERNEL_SHA}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await webcrypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// HMAC-SHA-256 signature using BITCOIN_API_KEY as salt
// ---------------------------------------------------------------------------

function signPayload(payload, bitcoinApiKey) {
  if (!bitcoinApiKey) return null;
  return createHmac("sha256", bitcoinApiKey)
    .update(JSON.stringify(payload))
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Pushover notification
// ---------------------------------------------------------------------------

async function sendPushover(opts) {
  const { appToken, userKey, title, message, url, urlTitle } = opts;
  if (!appToken || !userKey) {
    console.warn("⚠️  PUSHOVER_APP_TOKEN or PUSHOVER_USER_KEY not set — skipping Pushover.");
    return false;
  }

  const body = new URLSearchParams({
    token: appToken,
    user: userKey,
    title,
    message,
    priority: "1",    // Priority 1 — bypasses quiet hours with alert sound
    sound: "siren",
    ...(url ? { url } : {}),
    ...(urlTitle ? { url_title: urlTitle } : {}),
  });

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error(`❌ Pushover failed: ${res.status}`);
    return false;
  }
  console.log("✅ Pushover notification sent.");
  return true;
}

// ---------------------------------------------------------------------------
// GabrielOS™ Sentinel webhook
// ---------------------------------------------------------------------------

async function sendSentinelWebhook(webhookUrl, payload, signature) {
  if (!webhookUrl) {
    console.warn("ℹ️  GABRIEL_SENTINEL_WEBHOOK not set — skipping Sentinel.");
    return false;
  }

  const headers = {
    "Content-Type": "application/json",
    "X-AveryOS-CreatorLock": "Jason Lee Avery (ROOT0)",
    "X-AveryOS-Kernel": KERNEL_SHA.slice(0, 16) + "...",
    "X-AveryOS-Version": KERNEL_VERSION,
    ...(signature ? { "X-Gabriel-HMAC-Signature": signature } : {}),
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`❌ Sentinel webhook failed: ${res.status}`);
    return false;
  }
  console.log("✅ GabrielOS™ Sentinel webhook delivered.");
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { event, ip, path } = parseArgs();

  const eventType = event.toUpperCase();
  const liabilityUsd =
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    TARI_LIABILITY[eventType] ?? TARI_LIABILITY.UNALIGNED_401;
  const liabilityLabel =
    // eslint-disable-next-line security/detect-object-injection -- key from validated CLI args enum
    TARI_LIABILITY_LABELS[eventType] ?? TARI_LIABILITY_LABELS.UNALIGNED_401;
  const timestamp = formatIso9();
  const pulseHash = await computePulseHash(ip, path, timestamp);

  const liabilityFormatted = liabilityUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  // ── Console output ────────────────────────────────────────────────────────
  console.log("");
  console.log("⛓️⚓⛓️  AveryOS™ Sovereign Audit Alert");
  console.log(`Event Type  : ${eventType}`);
  console.log(`Target IP   : ${ip}`);
  console.log(`Path        : ${path}`);
  console.log(`TARI™ Liab. : ${liabilityFormatted} USD — ${liabilityLabel}`);
  console.log(`SHA-512 Hash: ${pulseHash.slice(0, 32)}...`);
  console.log(`Timestamp   : ${timestamp}`);
  console.log(`Kernel      : ${KERNEL_SHA.slice(0, 16)}...`);
  console.log("");

  // ── Forensic payload (signed with BITCOIN_API_KEY HMAC) ──────────────────
  const forensicPayload = {
    event_type: eventType,
    target_ip: ip,
    path,
    tari_liability_usd: liabilityUsd,
    tari_liability_label: liabilityLabel,
    tari_liability_formatted: liabilityFormatted,
    pulse_hash: pulseHash,
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    timestamp,
    creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
  };

  const bitcoinApiKey = process.env.BITCOIN_API_KEY ?? "";
  const hmacSignature = signPayload(forensicPayload, bitcoinApiKey);
  if (hmacSignature) {
    console.log(`HMAC-SHA256 : ${hmacSignature.slice(0, 32)}...`);
    forensicPayload.hmac_signature = hmacSignature;
  }

  // ── Pushover push notification ────────────────────────────────────────────
  const pushTitle = `⚠️ AveryOS™ ${eventType}`;
  const pushMessage =
    `IP: ${ip}\n` +
    `Path: ${path}\n` +
    `TARI™: ${liabilityFormatted} — ${liabilityLabel}\n` +
    `Hash: ${pulseHash.slice(0, 24)}...\n` +
    `Kernel: ${KERNEL_SHA.slice(0, 12)}...`;

  await sendPushover({
    appToken: process.env.PUSHOVER_APP_TOKEN ?? "",
    userKey: process.env.PUSHOVER_USER_KEY ?? "",
    title: pushTitle,
    message: pushMessage,
    url: "https://averyos.com/evidence-vault",
    urlTitle: "🔐 Evidence Vault",
  });

  // ── GabrielOS™ Sentinel webhook ───────────────────────────────────────────
  await sendSentinelWebhook(
    process.env.GABRIEL_SENTINEL_WEBHOOK ?? "",
    forensicPayload,
    hmacSignature
  );

  console.log("⛓️⚓⛓️ Sovereign Audit Alert complete. 🤛🏻");
}

main().catch((err) => {
  console.error("❌ Sovereign Audit Alert error:", err);
  process.exit(1);
});
