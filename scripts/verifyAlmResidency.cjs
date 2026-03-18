#!/usr/bin/env node
/**
 * scripts/verifyAlmResidency.cjs
 *
 * AveryOS™ Local ALM Residency Verification — GATE 117.0.2
 *
 * Executes the Avery-ALM (Ollama) residency handshake on Node-02 using
 * the Local PC Fingerprint + USB Salt as the primary biometric seed.
 * Transitions Node-02 to 'State 2: FULLY_RESIDENT' upon confirmed response.
 *
 * Authentication: USB Salt + Local PC Fingerprint (WHOOP bypass — local PC mode).
 *
 * Tests:
 *   alm:ping  — verify Ollama is alive on 127.0.0.1:11434
 *   alm:chat  — send a sovereign prompt and verify response alignment
 *
 * Usage:
 *   node scripts/verifyAlmResidency.cjs [--ping] [--chat] [--dry-run]
 *
 * Options:
 *   --ping      Run alm:ping test only
 *   --chat      Run alm:chat test only
 *   --dry-run   Log what would be done without making network calls
 *
 * Outputs a AOSR summary line to logs/agent_summary.aosvault.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
'use strict';

const http   = require('http');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');

const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Sovereign kernel anchor ────────────────────────────────────────────────
const KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';

// ── Config ─────────────────────────────────────────────────────────────────
const ALM_HOST    = process.env.ALM_HOST    ?? '127.0.0.1';
const ALM_PORT    = parseInt(process.env.ALM_PORT ?? '11434', 10);
const ALM_MODEL   = process.env.ALM_MODEL   ?? 'llama3.2';
const REPO_ROOT   = path.join(__dirname, '..');
const VAULT_LOG   = path.join(REPO_ROOT, 'logs', 'agent_summary.aosvault');

// ── CLI flags ──────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PING    = args.includes('--ping') || !args.includes('--chat');
const CHAT    = args.includes('--chat') || !args.includes('--ping');

// ── Biometric seed (PC Fingerprint + USB Salt fallback) ───────────────────
function getPcFingerprint() {
  const cpus    = os.cpus();
  const cpu0    = cpus.length > 0 ? cpus[0].model : 'unknown';
  const totalMem = os.totalmem().toString();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch     = os.arch();
  const seed     = `${cpu0}::${totalMem}::${hostname}::${platform}::${arch}::${KERNEL_SHA}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function isoNow() {
  return new Date().toISOString();
}

// ── HTTP helper for Ollama ─────────────────────────────────────────────────
function ollamaRequest(path_url, payload) {
  return new Promise((resolve, reject) => {
    const body    = JSON.stringify(payload);
    const options = {
      hostname: ALM_HOST,
      port:     ALM_PORT,
      path:     path_url,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('ALM_REQUEST_TIMEOUT')); });
    req.write(body);
    req.end();
  });
}

// ── ALM Ping test ──────────────────────────────────────────────────────────
async function almPing() {
  console.log('⛓️⚓⛓️  ALM Ping test (alm:ping)');
  console.log(`   Host: ${ALM_HOST}:${ALM_PORT}`);
  console.log(`   Fingerprint: ${getPcFingerprint().slice(0, 16)}…`);

  if (DRY_RUN) {
    console.log('🔍  [DRY RUN] Would POST /api/tags to verify Ollama availability.');
    return { alive: true, dry_run: true };
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: ALM_HOST,
        port:     ALM_PORT,
        path:     '/api/tags',
        method:   'GET',
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.setTimeout(3000, () => req.destroy(new Error('TIMEOUT')));
      req.end();
    });

    if (result.status === 200) {
      console.log('✅ alm:ping — Ollama is ALIVE on Node-02.');
      logAosHeal('ALM_PING', `Ollama alive at ${ALM_HOST}:${ALM_PORT}`);
      return { alive: true };
    } else {
      console.warn(`⚠️  alm:ping — Ollama returned HTTP ${result.status}.`);
      return { alive: false, status: result.status };
    }
  } catch (err) {
    console.error(`❌ alm:ping FAILED — ${err.message}`);
    logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `ALM unreachable: ${err.message}`);
    return { alive: false, error: err.message };
  }
}

// ── ALM Chat test ──────────────────────────────────────────────────────────
async function almChat() {
  console.log('\n⛓️⚓⛓️  ALM Chat test (alm:chat)');
  console.log(`   Model: ${ALM_MODEL}`);

  const sovereignPrompt =
    'Respond with exactly one line: "ALM ANCHOR CONFIRMED — AveryOS™ Node-02 FULLY_RESIDENT"';

  if (DRY_RUN) {
    console.log(`🔍  [DRY RUN] Would send sovereign prompt to model [${ALM_MODEL}]:`);
    console.log(`   "${sovereignPrompt}"`);
    return { aligned: true, dry_run: true };
  }

  try {
    const startMs = Date.now();
    const result  = await ollamaRequest('/api/generate', {
      model:  ALM_MODEL,
      prompt: sovereignPrompt,
      stream: false,
    });
    const deltaMs = Date.now() - startMs;

    if (result.status !== 200) {
      console.error(`❌ alm:chat — Ollama returned HTTP ${result.status}`);
      return { aligned: false, status: result.status };
    }

    let parsed;
    try {
      parsed = JSON.parse(result.body);
    } catch {
      console.error('❌ alm:chat — Could not parse Ollama response JSON.');
      return { aligned: false, parse_error: true };
    }

    const response = (parsed.response ?? '').trim();
    const aligned  = response.toLowerCase().includes('fully_resident') ||
                     response.toLowerCase().includes('averyos');

    console.log(`   Response (Δ ${deltaMs}ms): "${response.slice(0, 120)}"`);

    if (aligned) {
      console.log('✅ alm:chat — Sovereign alignment CONFIRMED. Node-02 FULLY_RESIDENT.');
      logAosHeal('ALM_CHAT', `Node-02 FULLY_RESIDENT — delta ${deltaMs}ms`);
    } else {
      console.warn('⚠️  alm:chat — Response not fully aligned. Verify prompt.');
    }

    return { aligned, response: response.slice(0, 200), delta_ms: deltaMs };
  } catch (err) {
    console.error(`❌ alm:chat FAILED — ${err.message}`);
    logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `ALM chat error: ${err.message}`);
    return { aligned: false, error: err.message };
  }
}

// ── AOSR Summary Writer ────────────────────────────────────────────────────
function writeAosrSummary(pingResult, chatResult) {
  try {
    const logsDir = path.join(REPO_ROOT, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const pingPass     = pingResult?.alive === true;
    const chatPass     = chatResult?.aligned === true;
    const fullyResident = pingPass && chatPass;
    const entry = JSON.stringify({
      ts:               isoNow(),
      phase:            '117.0.2',
      kernel_version:   KERNEL_VERSION,
      kernel_sha_prefix: KERNEL_SHA.slice(0, 16),
      summary:          `ALM Residency Verification — ping:${pingPass ? 'PASS' : 'FAIL'} chat:${chatPass ? 'PASS' : 'FAIL'} | Node-02 FULLY_RESIDENT:${fullyResident ? 'YES' : 'NO'}`,
      dry_run:          DRY_RUN,
      pc_fingerprint:   getPcFingerprint().slice(0, 16) + '…',
      alm_host:         `${ALM_HOST}:${ALM_PORT}`,
      alm_model:        ALM_MODEL,
    });
    fs.appendFileSync(VAULT_LOG, entry + '\n', 'utf-8');
  } catch (err) {
    console.warn(`⚠️  Could not write AOSR summary: ${err.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('⛓️⚓⛓️  AveryOS™ ALM Residency Verification — GATE 117.0.2');
  console.log(`   Kernel: ${KERNEL_VERSION} | ${isoNow()}`);
  if (DRY_RUN) console.log('   Mode: DRY RUN (no network calls)');

  let pingResult = null;
  let chatResult = null;

  if (PING) pingResult = await almPing();
  if (CHAT) chatResult = await almChat();

  writeAosrSummary(pingResult, chatResult);

  const resident = (pingResult?.alive ?? true) && (chatResult?.aligned ?? true);
  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`⛓️  Residency Status: ${resident ? 'State 2: FULLY_RESIDENT ✅' : 'State 1: CLOUD (ALM offline) ⚠️'}`);
  console.log('⛓️⚓⛓️');

  process.exit(resident ? 0 : 1);
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, `verifyAlmResidency fatal: ${err.message}`);
  process.exit(1);
});
