#!/usr/bin/env node
/**
 * scripts/generate-kaas-token.cjs
 *
 * AveryOS™ KaaS Token Generator — Phase 122 GATE 122.2.1
 *
 * Generates a signed RS256 nonce payload for the Residency Bridge endpoint
 * (POST /api/v1/residency/bridge) so that Node-02 can acquire a short-lived
 * VPC session token without manual key handling.
 *
 * Signing algorithm: RSASSA-PKCS1-v1_5 (RS256) with SHA-256.
 * The private key is loaded exclusively from the ~/.ssh directory — it is
 * never read from the current working directory or any other location.
 *
 * Payload signed (matches bridge expectation):
 *   JSON.stringify({ ts, node_id, nonce, kernel_sha })
 *
 * NFC Ingress Logging (--log-nfc):
 *   Appends an 'Unsolicited Proximity Event' entry to
 *   logs/ingress_events.aosvault (gitignored — never committed).
 *
 * Node-02 Heartbeat (--check-node02):
 *   Pings the local Ollama ALM endpoint to confirm Node-02 is live and
 *   ready to receive signing authority.
 *
 * Usage:
 *   node scripts/generate-kaas-token.cjs [options]
 *
 * Options:
 *   --node-id   <id>      Node identifier (default: NODE-02)
 *   --key       <file>    Private key filename in ~/.ssh/ (default: averyos-sovereign-key.pem)
 *   --site-url  <url>     Bridge endpoint base URL (default: https://averyos.com)
 *   --dry-run             Print payload only; do not POST to bridge
 *   --check-node02        Ping local Ollama ALM before token generation
 *   --log-nfc   <tag_id>  Log an NFC proximity event to the ingress vault
 *   --out       <file>    Write token response JSON to a file
 *   --verbose             Enable verbose output
 *
 * Environment variables (override defaults):
 *   AVERYOS_NODE_ID       Node identifier
 *   AVERYOS_SSH_KEY_FILE  Private key filename in ~/.ssh/
 *   SITE_URL              Bridge endpoint base URL
 *   VAULT_PASSPHRASE      Bearer token for bridge auth (optional)
 *
 * Exit codes:
 *   0 — Token issued successfully (or dry-run completed)
 *   1 — Key load failure, signature failure, or bridge rejection
 *   2 — Node-02 heartbeat failure (--check-node02 mode)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const https  = require('https');
const http   = require('http');

const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Sovereign kernel anchor ────────────────────────────────────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';

// ── ANSI colours ───────────────────────────────────────────────────────────────
const R     = '\x1b[0m';
const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN  = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED   = '\x1b[31m';
const DIM   = '\x1b[2m';

// ── CLI arg parser ────────────────────────────────────────────────────────────

function getArg(flag, defaultValue = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return defaultValue;
  return next;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

// ── Config ─────────────────────────────────────────────────────────────────────

const NODE_ID     = getArg('--node-id')  ?? process.env.AVERYOS_NODE_ID      ?? 'NODE-02';
const KEY_FILE    = getArg('--key')      ?? process.env.AVERYOS_SSH_KEY_FILE  ?? 'averyos-sovereign-key.pem';
const SITE_URL    = (getArg('--site-url') ?? process.env.SITE_URL             ?? 'https://averyos.com').replace(/\/$/, '');
const NFC_TAG_ID  = getArg('--log-nfc');
const OUT_FILE    = getArg('--out');
const DRY_RUN     = hasFlag('--dry-run');
const CHECK_NODE  = hasFlag('--check-node02');
const VERBOSE     = hasFlag('--verbose');

/** Private key is ALWAYS resolved inside ~/.ssh — never from cwd or user-supplied path. */
const SSH_DIR     = path.join(os.homedir(), '.ssh');
// codeql[js/file-system-race]
const KEY_PATH    = path.resolve(SSH_DIR, path.basename(KEY_FILE));

const REPO_ROOT   = path.join(__dirname, '..');
const LOGS_DIR    = path.join(REPO_ROOT, 'logs');
/** NFC ingress vault — gitignored (*.aosvault), never committed. */
const INGRESS_VAULT = path.resolve(LOGS_DIR, 'ingress_events.aosvault');

const ALM_HOST    = process.env.ALM_HOST ?? '127.0.0.1';
const ALM_PORT    = parseInt(process.env.ALM_PORT ?? '11434', 10);

// ── Helpers ────────────────────────────────────────────────────────────────────

function verbose(msg) {
  if (VERBOSE) console.log(`${DIM}  ℹ  ${msg}${R}`);
}

function success(msg) { console.log(`  ${GREEN}✅${R} ${msg}`); }
function warn(msg)    { console.log(`  ${YELLOW}⚠️ ${R} ${msg}`); }
function fail(msg)    { console.error(`  ${RED}❌${R} ${msg}`); }
function info(msg)    { console.log(`  ${CYAN}→${R}  ${msg}`); }

/** Generate a cryptographically secure 32-byte hex nonce. */
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

/** Load the RS256 private key from ~/.ssh — path is hardlocked to SSH_DIR. */
function loadPrivateKey() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(
      `Private key not found: ${KEY_PATH}\n` +
      `Generate with: ssh-keygen -t rsa -b 4096 -m PEM -f ${KEY_PATH} -N ""`
    );
  }

  const pem = fs.readFileSync(KEY_PATH, 'utf8');

  // Validate it looks like a PEM private key (PKCS#1 or PKCS#8)
  if (
    !pem.includes('-----BEGIN RSA PRIVATE KEY-----') &&
    !pem.includes('-----BEGIN PRIVATE KEY-----')
  ) {
    throw new Error(
      `Key at ${KEY_PATH} is not a recognised PEM private key.\n` +
      `Expected RSA PKCS#1 (BEGIN RSA PRIVATE KEY) or PKCS#8 (BEGIN PRIVATE KEY).`
    );
  }

  return pem;
}

/**
 * Sign the canonical bridge payload using RSASSA-PKCS1-v1_5 + SHA-256 (RS256).
 * Returns the Base64URL-encoded signature bytes.
 */
function signPayload(privateKeyPem, payloadObj) {
  const data = JSON.stringify(payloadObj);
  verbose(`Signing payload: ${data}`);

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data, 'utf8');
  const sigBuf = sign.sign(privateKeyPem);

  // Convert to Base64URL (bridge uses atob on the Base64URL-encoded sig)
  return sigBuf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Make an HTTPS or HTTP request and return the parsed JSON response. */
function request(urlStr, method, body, headers) {
  return new Promise((resolve, reject) => {
    const url    = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const mod    = isHttps ? https : http;
    const bodyStr = JSON.stringify(body);

    const opts = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    };

    const req = mod.request(opts, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(new Error('Request timed out')); });
    req.write(bodyStr);
    req.end();
  });
}

// ── Node-02 Heartbeat ──────────────────────────────────────────────────────────

async function checkNode02Heartbeat() {
  info(`Checking Node-02 ALM heartbeat at ${ALM_HOST}:${ALM_PORT}…`);
  return new Promise((resolve) => {
    const mod = http;
    const opts = {
      hostname: ALM_HOST,
      port:     ALM_PORT,
      path:     '/api/tags',
      method:   'GET',
    };
    const req = mod.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(raw);
            const models = Array.isArray(data?.models) ? data.models : [];
            success(`Node-02 ALM live — ${models.length} model(s) loaded`);
            if (VERBOSE) {
              models.forEach((m) => verbose(`  model: ${m.name ?? m.model ?? JSON.stringify(m)}`));
            }
            resolve(true);
          } catch {
            success('Node-02 ALM live (response OK)');
            resolve(true);
          }
        } else {
          warn(`Node-02 ALM responded with HTTP ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      warn(`Node-02 ALM unreachable: ${err.message}`);
      resolve(false);
    });
    req.setTimeout(5_000, () => {
      req.destroy();
      warn('Node-02 ALM ping timed out');
      resolve(false);
    });
    req.end();
  });
}

// ── NFC Ingress Logging ────────────────────────────────────────────────────────

/**
 * Append an NFC proximity event to logs/ingress_events.aosvault.
 * The file is gitignored (*.aosvault) and never committed to the repository.
 *
 * Event context: NFC Tag ID '0100061737...E6232B7' observed near Node-02
 * hardware.  Classified as 'Unsolicited Proximity Event' and linked to the
 * PDP Setup Wizard Failure at 03:17 PM MDT (GATE 122.2.2).
 */
function logNfcIngressEvent(tagId, contextNote) {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  const event = {
    event_type:    'UNSOLICITED_PROXIMITY_EVENT',
    tag_id:        tagId,
    kernel_sha:    KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    node_id:       NODE_ID,
    logged_at:     new Date().toISOString(),
    context:       contextNote ?? 'NFC proximity event — no context provided',
    classification: 'FORENSIC_INGRESS',
    gate:          'GATE 122.2.2',
  };

  let events = [];
  if (fs.existsSync(INGRESS_VAULT)) {
    try {
      events = JSON.parse(fs.readFileSync(INGRESS_VAULT, 'utf8'));
      if (!Array.isArray(events)) events = [];
    } catch {
      events = [];
    }
  }

  events.push(event);
  fs.writeFileSync(INGRESS_VAULT, JSON.stringify(events, null, 2), 'utf8');

  success(`NFC ingress event logged → ${path.relative(REPO_ROOT, INGRESS_VAULT)}`);
  info(`  Tag ID:   ${tagId}`);
  info(`  Context:  ${event.context}`);
  verbose(`  Full event: ${JSON.stringify(event)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async function main() {
  console.log(`\n${BOLD}⛓️⚓⛓️  AveryOS™ KaaS Token Generator — ${KERNEL_VERSION}${R}`);
  console.log(`${DIM}  Kernel SHA: ${KERNEL_SHA.slice(0, 32)}…${R}\n`);

  // ── GATE 122.2.4 — Node-02 Residency Heartbeat ──────────────────────────
  if (CHECK_NODE) {
    const alive = await checkNode02Heartbeat();
    if (!alive) {
      fail('Node-02 ALM heartbeat failed. Ensure Ollama is running on Node-02.');
      warn('To start Ollama: ollama serve');
      process.exit(2);
    }
    console.log();
  }

  // ── GATE 122.2.2 — NFC Ingress Log ──────────────────────────────────────
  if (NFC_TAG_ID) {
    const nfcContext = process.env.NFC_CONTEXT
      ?? 'Linked to PDP Setup Wizard Failure observed at 03:17 PM MDT (GATE 122.2.2)';
    logNfcIngressEvent(NFC_TAG_ID, nfcContext);
    console.log();
  }

  // ── GATE 122.2.1 — RS256 Token Generation ───────────────────────────────
  info(`Loading private key: ${KEY_PATH}`);

  let privateKeyPem;
  try {
    privateKeyPem = loadPrivateKey();
    success(`Private key loaded (${path.basename(KEY_PATH)})`);
  } catch (err) {
    fail(`Key load failed: ${err.message}`);
    logAosError(AOS_ERROR.VAULT_NOT_CONFIGURED, 'generate-kaas-token.cjs', err.message);
    process.exit(1);
  }

  const ts      = new Date().toISOString();
  const nonce   = generateNonce();
  const payload = { ts, node_id: NODE_ID, nonce, kernel_sha: KERNEL_SHA };

  verbose(`Nonce: ${nonce}`);
  verbose(`Timestamp: ${ts}`);

  let signature;
  try {
    signature = signPayload(privateKeyPem, payload);
    success(`RS256 signature computed (${signature.length} chars)`);
  } catch (err) {
    fail(`RS256 signing failed: ${err.message}`);
    logAosError(AOS_ERROR.INTERNAL_ERROR, 'generate-kaas-token.cjs', err.message);
    process.exit(1);
  }

  const bridgeBody = { ...payload, signature };

  console.log(`\n${BOLD}Bridge payload:${R}`);
  console.log(JSON.stringify(bridgeBody, null, 2));

  if (DRY_RUN) {
    console.log(`\n${YELLOW}[DRY RUN]${R} Payload ready. POST to: ${SITE_URL}/api/v1/residency/bridge`);
    process.exit(0);
  }

  // ── POST to bridge ──────────────────────────────────────────────────────
  const bridgeUrl  = `${SITE_URL}/api/v1/residency/bridge`;
  const vaultPass  = process.env.VAULT_PASSPHRASE ?? '';
  const authHeader = vaultPass ? { 'Authorization': `Bearer ${vaultPass}` } : {};

  info(`POSTing to bridge: ${bridgeUrl}`);

  let response;
  try {
    response = await request(bridgeUrl, 'POST', bridgeBody, authHeader);
  } catch (err) {
    fail(`Bridge POST failed: ${err.message}`);
    logAosError(AOS_ERROR.EXTERNAL_API_ERROR, 'generate-kaas-token.cjs', err.message);
    process.exit(1);
  }

  if (response.status === 200 && response.body?.ok) {
    console.log(`\n${GREEN}${BOLD}✅ VPC session token issued${R}`);
    info(`  session_token: ${response.body.session_token?.slice(0, 16) ?? '?'}…`);
    info(`  expires_at:    ${response.body.expires_at ?? 'unknown'}`);
    info(`  bridge_gate:   ${response.body.bridge_gate ?? 'unknown'}`);
    logAosHeal('KaaS token issued', 'generate-kaas-token.cjs', 'VPC session token successfully issued from residency bridge.');
  } else {
    fail(`Bridge rejected token (HTTP ${response.status}): ${JSON.stringify(response.body)}`);
    logAosError(AOS_ERROR.INVALID_AUTH, 'generate-kaas-token.cjs',
      `Bridge rejected: HTTP ${response.status} — ${JSON.stringify(response.body)}`);
    process.exit(1);
  }

  // ── Optional: write response to file ───────────────────────────────────
  if (OUT_FILE) {
    // Constrain output to the repo logs directory to prevent accidental overwrites.
    // codeql[js/file-system-race]
    const outPath = path.resolve(LOGS_DIR, path.basename(OUT_FILE));
    try {
      if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(response.body, null, 2), 'utf8');
      success(`Token response written to: ${outPath}`);
    } catch (err) {
      warn(`Could not write response to file: ${err.message}`);
    }
  }

  console.log(`\n${DIM}⛓️⚓⛓️  KaaS token generation complete — GATE 122.2.1 ✅${R}\n`);
})().catch((err) => {
  fail(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
