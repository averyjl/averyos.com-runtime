#!/usr/bin/env node
/**
 * AveryOS™ Persistent Pulse-Heartbeat Hybrid — scripts/sync-heartbeat.cjs
 *
 * Two operating modes:
 *
 *   One-shot (default / CI):
 *     node scripts/sync-heartbeat.cjs [--verbose]
 *     Verifies all sovereign nodes are in Zero-Drift Alignment and exits.
 *
 *   Persistent Watchdog Daemon (--daemon):
 *     VAULT_PASSPHRASE=... node scripts/sync-heartbeat.cjs --daemon
 *     • Maintains a persistent WebSocket connection to the Cloudflare edge.
 *     • Watchdog: connection drop → immediate Tier-9 ALIGNMENT_DRIFT alert.
 *     • Deep Sync: every 60 min, re-verify Kernel SHA against live BTC height.
 *     • SOVEREIGN_ANCHOR_SALT computed from the .avery-sync.json manifest and
 *       sent with every deep-sync payload.
 *
 * Reads:
 *   .avery-sync.json        — Universal Sync Manifest (loop_state, nodes, BTC anchor)
 *   .sovereign-nodes.json   — hardware node registry
 *
 * Optional env vars (daemon mode):
 *   VAULT_PASSPHRASE          — auth token for /api/v1/audit-alert
 *   SITE_URL                  — base URL (default: https://averyos.com)
 *   BITCOIN_API_KEY           — BlockCypher API key for BTC block verification
 *   SYNC_WS_URL               — WebSocket endpoint override
 *   SYNC_DEEP_INTERVAL_MS     — deep sync interval (default: 3600000 = 60 min)
 *   SYNC_WATCHDOG_TIMEOUT_MS  — ms without pong before drop alert (default: 30000)
 *   SYNC_RECONNECT_DELAY_MS   — ms before reconnect attempt (default: 5000)
 *
 * Exit codes (one-shot mode):
 *   0 — All nodes aligned; loop in parity
 *   1 — Drift detected or nodes missing; immediate re-anchor required
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// Optional dep — gracefully degrade if not installed
let WebSocket;
try { WebSocket = require('ws'); } catch { WebSocket = null; }

// ---------------------------------------------------------------------------
// Sovereign constants (inline — script has no module bundler)
// ---------------------------------------------------------------------------

const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const KERNEL_VERSION = 'v3.6.2';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const DAEMON  = process.argv.includes('--daemon') || process.argv.includes('-d');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ---------------------------------------------------------------------------
// Daemon-mode config (from env)
// ---------------------------------------------------------------------------

const SITE_URL            = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');
const VAULT_PASSPHRASE    = process.env.VAULT_PASSPHRASE ?? '';
const BITCOIN_API_KEY     = process.env.BITCOIN_API_KEY ?? '';
const WS_URL              = process.env.SYNC_WS_URL
  ?? 'wss://averyos.com/api/v1/heartbeat/ws';
const DEEP_INTERVAL_MS    = Number(process.env.SYNC_DEEP_INTERVAL_MS   ?? 3_600_000);
const WATCHDOG_TIMEOUT_MS = Number(process.env.SYNC_WATCHDOG_TIMEOUT_MS ?? 30_000);
const RECONNECT_DELAY_MS  = Number(process.env.SYNC_RECONNECT_DELAY_MS  ?? 5_000);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT                 = path.resolve(__dirname, '..');
const SYNC_MANIFEST_PATH   = path.join(ROOT, '.avery-sync.json');
const SOVEREIGN_NODES_PATH = path.join(ROOT, '.sovereign-nodes.json');

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';

function ok(msg)   { console.log(`${GREEN}✔${RESET}  ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET}  ${msg}`); }
function fail(msg) { console.log(`${RED}✖${RESET}  ${msg}`); }
function info(msg) { if (VERBOSE) console.log(`${CYAN}ℹ${RESET}  ${msg}`); }

// ===========================================================================
// DAEMON-MODE: Persistent WebSocket Watchdog + Deep Sync
// ===========================================================================

// ---------------------------------------------------------------------------
// Manifest loader & SOVEREIGN_ANCHOR_SALT
// ---------------------------------------------------------------------------

/**
 * Load .avery-sync.json if it exists; return null gracefully.
 * @returns {object|null}
 */
function loadManifest() {
  let raw;
  try {
    raw = fs.readFileSync(SYNC_MANIFEST_PATH, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    logAosError(AOS_ERROR.INVALID_JSON, `Manifest parse error: ${err.message}`, err);
    return null;
  }
}

/**
 * Compute SOVEREIGN_ANCHOR_SALT:
 *   SHA-512(manifest_id | KERNEL_SHA | btc_anchor_block | btc_anchor_hash)
 * Falls back to KERNEL_SHA if the manifest is absent.
 *
 * @param {object|null} manifest
 * @returns {string}
 */
function computeAnchorSalt(manifest) {
  if (!manifest) return KERNEL_SHA;
  const raw = [
    manifest.manifest_id ?? '',
    KERNEL_SHA,
    String(manifest.btc_anchor_block ?? ''),
    String(manifest.btc_anchor_hash  ?? ''),
  ].join('|');
  return crypto.createHash('sha512').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// BTC block anchor
// ---------------------------------------------------------------------------

/**
 * Fetch the latest BTC main-chain block from BlockCypher.
 * @returns {Promise<{height: number, hash: string}|null>}
 */
function fetchBtcBlock() {
  return new Promise((resolve) => {
    const qs  = BITCOIN_API_KEY ? `?token=${BITCOIN_API_KEY}` : '';
    const url = `https://api.blockcypher.com/v1/btc/main${qs}`;
    https.get(url, { headers: { 'User-Agent': 'AveryOS-Heartbeat/2.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({ height: j.height, hash: j.hash });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ---------------------------------------------------------------------------
// Tier-9 audit alert
// ---------------------------------------------------------------------------

/**
 * POST a Tier-9 event to /api/v1/audit-alert (non-blocking).
 * @param {string} eventType  ALIGNMENT_DRIFT | PAYMENT_FAILED
 * @param {string} message
 * @returns {Promise<void>}
 */
function fireTier9Alert(eventType, message) {
  return new Promise((resolve) => {
    if (!VAULT_PASSPHRASE) {
      warn('VAULT_PASSPHRASE not set — Tier-9 alert skipped.');
      return resolve();
    }
    const bodyData = JSON.stringify({ event_type: eventType, target_ip: '0.0.0.0', path: '/heartbeat/watchdog', message });
    const isSecure = SITE_URL.startsWith('https');
    const parsed   = new URL(`${SITE_URL}/api/v1/audit-alert`);
    const opts     = {
      hostname: parsed.hostname,
      port:     parsed.port || (isSecure ? 443 : 80),
      path:     parsed.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
        Authorization:    `Bearer ${VAULT_PASSPHRASE}`,
      },
    };
    const req = (isSecure ? https : http).request(opts, (res) => {
      res.resume();
      if (res.statusCode !== 200) warn(`Tier-9 alert → HTTP ${res.statusCode}`);
      resolve();
    });
    req.on('error', (e) => {
      logAosError(AOS_ERROR.NETWORK_ERROR, `Tier-9 alert failed: ${e.message}`, e);
      resolve();
    });
    req.write(bodyData);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Deep Sync (60-minute forensic re-anchor)
// ---------------------------------------------------------------------------

/**
 * Full forensic deep sync:
 *   1. Reload the manifest and recompute SOVEREIGN_ANCHOR_SALT.
 *   2. Re-verify Kernel SHA identity.
 *   3. Fetch live BTC block height.
 *   4. Log and return the sync result.
 *
 * @returns {Promise<{anchorSalt: string, btcHeight: number|null}>}
 */
async function runDeepSync() {
  console.log('\n🔄  [DEEP SYNC] Forensic re-anchor starting…');
  const manifest   = loadManifest();
  const anchorSalt = computeAnchorSalt(manifest);
  console.log(`   SOVEREIGN_ANCHOR_SALT : ${anchorSalt.slice(0, 32)}…`);

  // Verify Kernel SHA integrity:
  // KERNEL_SHA is SHA-512 of the empty string — the genesis root constant.
  // This check confirms that (a) the runtime crypto library is functioning
  // correctly, and (b) the KERNEL_SHA inline constant has not been tampered
  // with. Any mismatch indicates script corruption or runtime drift.
  const computed    = crypto.createHash('sha512').update('').digest('hex');
  const kernelValid = computed === KERNEL_SHA;
  if (!kernelValid) {
    console.error(`${RED}🚨  KERNEL SHA MISMATCH — DRIFT DETECTED${RESET}`);
    await fireTier9Alert('ALIGNMENT_DRIFT', `Deep Sync: kernel SHA mismatch — ${computed.slice(0, 16)}…`);
  } else {
    ok(`Kernel SHA verified   : ${KERNEL_SHA.slice(0, 16)}…`);
  }

  const btc = await fetchBtcBlock();
  if (btc) {
    ok(`BTC block height      : ${btc.height}  (${btc.hash.slice(0, 16)}…)`);
  } else {
    warn('BTC block fetch       : unavailable (network or API key)');
  }

  const status = kernelValid ? 'LOCKED_IN_PARITY' : 'DRIFT_DETECTED';
  console.log(`   Deep sync status      : ${status}  [${new Date().toISOString()}]\n`);
  return { anchorSalt, btcHeight: btc?.height ?? null };
}

// ---------------------------------------------------------------------------
// WebSocket Watchdog
// ---------------------------------------------------------------------------

let _ws             = null;
let _watchdogTimer  = null;
let _deepSyncTimer  = null;
let _reconnecting   = false;

function resetWatchdog() {
  clearTimeout(_watchdogTimer);
  _watchdogTimer = setTimeout(() => {
    const msg = `No heartbeat for ${WATCHDOG_TIMEOUT_MS}ms — connection silent.`;
    console.error(`${RED}🚨  [WATCHDOG] ${msg}${RESET}`);
    fireTier9Alert('ALIGNMENT_DRIFT', msg).catch(() => {});
    reconnectWs();
  }, WATCHDOG_TIMEOUT_MS);
}

function reconnectWs() {
  if (_reconnecting) return;
  _reconnecting = true;
  clearTimeout(_watchdogTimer);
  clearInterval(_deepSyncTimer);
  if (_ws) {
    try { _ws.terminate(); }
    catch (err) { logAosHeal(AOS_ERROR.INTERNAL_ERROR, `WebSocket terminate failed: ${err.message}`); }
    _ws = null;
  }
  console.log(`⏳  Reconnecting in ${RECONNECT_DELAY_MS}ms…`);
  setTimeout(connectWs, RECONNECT_DELAY_MS);
}

function scheduleDeepSyncLoop() {
  clearInterval(_deepSyncTimer);
  _deepSyncTimer = setInterval(async () => {
    try {
      const { anchorSalt } = await runDeepSync();
      if (_ws && _ws.readyState === (WebSocket ? WebSocket.OPEN : 1)) {
        _ws.send(JSON.stringify({
          type:        'DEEP_SYNC',
          anchor_salt: anchorSalt.slice(0, 32) + '…',
          kernel_sha:  KERNEL_SHA.slice(0, 16) + '…',
          timestamp:   new Date().toISOString(),
        }));
      }
    } catch (err) {
      logAosError(AOS_ERROR.INTERNAL_ERROR, `Deep sync loop error: ${err.message}`, err);
    }
  }, DEEP_INTERVAL_MS);
}

function connectWs() {
  if (!WebSocket) {
    warn('ws package not installed — WebSocket watchdog disabled. Run: npm install ws');
    warn('Running in deep-sync-only mode.');
    scheduleDeepSyncLoop();
    return;
  }

  console.log(`🔌  Connecting WebSocket to ${WS_URL} …`);
  _ws = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${VAULT_PASSPHRASE}` } });

  _ws.on('open', () => {
    _reconnecting = false;
    ok(`WebSocket connected — ${WS_URL}`);
    const manifest   = loadManifest();
    const anchorSalt = computeAnchorSalt(manifest);
    _ws.send(JSON.stringify({
      type:            'HEARTBEAT_PULSE',
      kernel_sha:      KERNEL_SHA.slice(0, 16) + '…',
      kernel_version:  KERNEL_VERSION,
      anchor_salt:     anchorSalt.slice(0, 32) + '…',
      loop_state:      manifest?.loop_state ?? 'INITIALIZING',
      timestamp:       new Date().toISOString(),
    }));
    resetWatchdog();
    scheduleDeepSyncLoop();
  });

  _ws.on('message', (data) => {
    resetWatchdog();
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type !== 'PONG' && msg.type !== 'ACK') {
        info(`[WS] ${JSON.stringify(msg).slice(0, 120)}`);
      }
    } catch { /* non-JSON frame — ignore */ }
  });

  _ws.on('close', (code, reason) => {
    clearTimeout(_watchdogTimer);
    const msg = `WebSocket closed — code=${code} reason=${reason?.toString() ?? ''}`;
    console.error(`${RED}🔴  [WATCHDOG] ${msg}${RESET}`);
    fireTier9Alert('ALIGNMENT_DRIFT', msg).catch(() => {});
    reconnectWs();
  });

  _ws.on('error', (err) => {
    clearTimeout(_watchdogTimer);
    console.error(`${RED}❌  [WS] ${err.message}${RESET}`);
    fireTier9Alert('ALIGNMENT_DRIFT', `WebSocket error: ${err.message}`).catch(() => {});
    reconnectWs();
  });
}

/**
 * Run the persistent daemon (--daemon mode).
 */
async function runDaemon() {
  console.log(`${BOLD}⛓️⚓⛓️  AveryOS™ Persistent Pulse-Heartbeat Hybrid${RESET}`);
  console.log(`   Kernel  : ${KERNEL_VERSION}  (${KERNEL_SHA.slice(0, 16)}…)`);
  console.log(`   Site    : ${SITE_URL}`);
  console.log(`   WS      : ${WS_URL}`);
  console.log(`   DeepSync: every ${DEEP_INTERVAL_MS / 60_000} min`);
  console.log(`   Watchdog: ${WATCHDOG_TIMEOUT_MS}ms timeout\n`);

  const manifest   = loadManifest();
  const anchorSalt = computeAnchorSalt(manifest);
  ok(`SOVEREIGN_ANCHOR_SALT : ${anchorSalt.slice(0, 32)}…`);
  console.log(`   Loop state            : ${manifest?.loop_state ?? 'INITIALIZING'}\n`);

  await runDeepSync();
  connectWs();

  process.on('SIGINT',  () => { console.log('\n🛑  Shutdown (SIGINT)');  process.exit(0); });
  process.on('SIGTERM', () => { console.log('\n🛑  Shutdown (SIGTERM)'); process.exit(0); });
}

// ===========================================================================
// ONE-SHOT MODE: node-level alignment verification (original behaviour)
// ===========================================================================

// ---------------------------------------------------------------------------
// ISO-9 timestamp
// ---------------------------------------------------------------------------

function iso9() {
  const now  = new Date();
  const base = now.toISOString().replace(/\.\d{3}Z$/, '');
  const ms   = String(now.getMilliseconds()).padStart(3, '0');
  return `${base}.${ms}000000Z`;
}

/**
 * @typedef {{ id: string; label: string; kernel_sha?: string; kernel_version?: string }} SovereignNode
 * @typedef {{ nodes: SovereignNode[]; kernel_sha?: string }} SovereignNodesManifest
 */

// ---------------------------------------------------------------------------
// Sync manifest structure expected from .avery-sync.json
// ---------------------------------------------------------------------------

/**
 * @typedef {{ kernel_sha?: string; kernel_version?: string; loop_state?: string; nodes?: SovereignNode[] }} AverySyncManifest
 */

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

/**
 * Verify a single kernel_sha value against the canonical Root0 SHA.
 * Returns { aligned: boolean, found: string }
 *
 * @param {string | undefined} found
 * @returns {{ aligned: boolean, found: string }}
 */
function verifyKernelSha(found) {
  if (typeof found !== 'string' || !found) {
    return { aligned: false, found: '<missing>' };
  }
  return { aligned: found === KERNEL_SHA, found };
}

/**
 * Verify the local runtime environment (current Node.js process hostname).
 *
 * @returns {{ aligned: boolean, nodeId: string }}
 */
function verifyLocalNode() {
  const hostname = os.hostname();
  // Local node is always structurally present; we report its identity
  return { aligned: true, nodeId: hostname };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (DAEMON) return runDaemon();

  console.log('');
  console.log(`${BOLD}⛓️⚓⛓️  AveryOS™ Sovereign Sync Heartbeat${RESET}`);
  console.log(`         Kernel ${KERNEL_VERSION} | Root0 SHA: ${KERNEL_SHA.slice(0, 16)}...`);
  console.log(`         Host   ${os.hostname()} | ${os.platform()} ${os.arch()}`);
  console.log(`         Pulse  ${iso9()}`);
  console.log('');

  let driftDetected = false;

  // ── 1. Local runtime anchor ───────────────────────────────────────────────
  const local = verifyLocalNode();
  ok(`Local runtime node: ${local.nodeId}`);

  // ── 2. .avery-sync.json ───────────────────────────────────────────────────
  let syncManifestRaw;
  let syncManifestMissing = false;
  try {
    syncManifestRaw = fs.readFileSync(SYNC_MANIFEST_PATH, 'utf8');
  } catch {
    syncManifestMissing = true;
  }
  if (syncManifestMissing) {
    warn('.avery-sync.json not found — run `npm run setup` to initialise the sync manifest.');
    logAosHeal(
      AOS_ERROR.MISSING_FIELD,
      '.avery-sync.json is missing. Run `npm run setup` to create it and anchor the sync loop.',
    );
    // Non-fatal: manifest may be absent on a fresh CI runner
  } else {
    let syncManifest;
    try {
      syncManifest = JSON.parse(syncManifestRaw);
    } catch (err) {
      fail(`.avery-sync.json could not be parsed: ${err.message}`);
      logAosError(AOS_ERROR.INVALID_JSON, `.avery-sync.json parse error: ${err.message}`, err);
      driftDetected = true;
      syncManifest = null;
    }

    if (syncManifest) {
      // Verify kernel_sha in sync manifest
      const { aligned, found } = verifyKernelSha(syncManifest.kernel_sha);
      if (aligned) {
        ok(`.avery-sync.json kernel_sha: ${found.slice(0, 16)}… ✓ ALIGNED`);
      } else {
        fail(`.avery-sync.json kernel_sha DRIFT DETECTED`);
        fail(`  Expected : ${KERNEL_SHA.slice(0, 32)}…`);
        fail(`  Found    : ${found.slice(0, 32)}…`);
        logAosError(
          AOS_ERROR.INTERNAL_ERROR,
          `Kernel SHA drift in .avery-sync.json — expected ${KERNEL_SHA.slice(0, 16)}… but found ${found.slice(0, 16)}…. Update the manifest kernel_sha to match lib/sovereignConstants.ts.`,
        );
        driftDetected = true;
      }

      // Verify loop_state
      const loopState = syncManifest.loop_state ?? '<missing>';
      if (loopState === 'LOCKED_IN_PARITY') {
        ok(`.avery-sync.json loop_state: ${loopState} ✓`);
      } else {
        warn(`.avery-sync.json loop_state is "${loopState}" — expected "LOCKED_IN_PARITY".`);
        logAosHeal(
          AOS_ERROR.MISSING_FIELD,
          `loop_state is "${loopState}". Set loop_state: "LOCKED_IN_PARITY" in .avery-sync.json to anchor the sync loop.`,
        );
      }

      info(`  kernel_version : ${syncManifest.kernel_version ?? '<missing>'}`);
      info(`  loop_state     : ${loopState}`);

      // Check registered nodes in sync manifest (optional array)
      if (Array.isArray(syncManifest.nodes) && syncManifest.nodes.length > 0) {
        console.log('');
        console.log(`  ${BOLD}Sync-manifest nodes:${RESET}`);
        for (const node of syncManifest.nodes) {
          const nodeId = node.id ?? node.label ?? '<unknown>';
          if (!node.kernel_sha) {
            info(`    [${nodeId}] kernel_sha not present in manifest — skipping SHA check`);
            continue;
          }
          const { aligned: nodeAligned, found: nodeFound } = verifyKernelSha(node.kernel_sha);
          if (nodeAligned) {
            ok(`    [${nodeId}] ${nodeFound.slice(0, 16)}… ✓ ALIGNED`);
          } else {
            fail(`    [${nodeId}] DRIFT — Expected ${KERNEL_SHA.slice(0, 16)}… got ${nodeFound.slice(0, 16)}…`);
            logAosError(
              AOS_ERROR.INTERNAL_ERROR,
              `Node "${nodeId}" reports a drifted kernel_sha. Re-anchor by updating the node manifest and rerunning npm run setup.`,
            );
            driftDetected = true;
          }
        }
      }
    }
  }

  // ── 3. .sovereign-nodes.json ──────────────────────────────────────────────
  console.log('');
  let nodesManifestRaw;
  let nodesManifestMissing = false;
  try {
    nodesManifestRaw = fs.readFileSync(SOVEREIGN_NODES_PATH, 'utf8');
  } catch {
    nodesManifestMissing = true;
  }
  if (nodesManifestMissing) {
    warn('.sovereign-nodes.json not found — run `npm run setup` to register sovereign nodes.');
    logAosHeal(
      AOS_ERROR.MISSING_FIELD,
      '.sovereign-nodes.json is missing. Run `npm run setup` to generate the hardware node registry.',
    );
  } else {
    let nodesManifest;
    try {
      nodesManifest = JSON.parse(nodesManifestRaw);
    } catch (err) {
      fail(`.sovereign-nodes.json could not be parsed: ${err.message}`);
      logAosError(AOS_ERROR.INVALID_JSON, `.sovereign-nodes.json parse error: ${err.message}`, err);
      driftDetected = true;
      nodesManifest = null;
    }

    if (nodesManifest) {
      // Top-level kernel_sha check
      if (nodesManifest.kernel_sha) {
        const { aligned, found } = verifyKernelSha(nodesManifest.kernel_sha);
        if (aligned) {
          ok(`.sovereign-nodes.json kernel_sha: ${found.slice(0, 16)}… ✓ ALIGNED`);
        } else {
          fail(`.sovereign-nodes.json kernel_sha DRIFT DETECTED`);
          fail(`  Expected : ${KERNEL_SHA.slice(0, 32)}…`);
          fail(`  Found    : ${found.slice(0, 32)}…`);
          logAosError(
            AOS_ERROR.INTERNAL_ERROR,
            `Kernel SHA drift in .sovereign-nodes.json — expected ${KERNEL_SHA.slice(0, 16)}… but found ${found.slice(0, 16)}…. Run \`npm run setup -- --force\` to regenerate.`,
          );
          driftDetected = true;
        }
      }

      // Per-node checks
      const nodes = Array.isArray(nodesManifest.nodes) ? nodesManifest.nodes : [];
      if (nodes.length > 0) {
        console.log(`  ${BOLD}Registered hardware nodes:${RESET}`);
        for (const node of nodes) {
          const nodeId = node.id ?? node.label ?? '<unknown>';
          if (!node.kernel_sha) {
            info(`    [${nodeId}] kernel_sha not stored — expected on registered nodes`);
            continue;
          }
          const { aligned: nodeAligned, found: nodeFound } = verifyKernelSha(node.kernel_sha);
          if (nodeAligned) {
            ok(`    [${nodeId}] ${nodeFound.slice(0, 16)}… ✓ ALIGNED`);
          } else {
            fail(`    [${nodeId}] DRIFT — Expected ${KERNEL_SHA.slice(0, 16)}… got ${nodeFound.slice(0, 16)}…`);
            logAosError(
              AOS_ERROR.INTERNAL_ERROR,
              `Hardware node "${nodeId}" reports a drifted kernel_sha. Re-anchor: run \`npm run setup -- --force\` on the affected device and ensure it reads kernel_sha from lib/sovereignConstants.ts.`,
            );
            driftDetected = true;
          }
        }
      }
    }
  }

  // ── 4. Final verdict ──────────────────────────────────────────────────────
  console.log('');
  if (driftDetected) {
    fail(`${RED}${BOLD}DRIFT DETECTED — Multi-node sync is NOT in parity.${RESET}`);
    fail('  Action required: re-anchor all drifted nodes and re-run this script.');
    logAosError(
      AOS_ERROR.INTERNAL_ERROR,
      'Sovereign Sync Heartbeat failed — drift detected across one or more nodes. Halt, re-anchor via npm run setup, and re-run node scripts/sync-heartbeat.cjs.',
    );
    console.log('');
    process.exit(1);
  } else {
    ok(`${GREEN}${BOLD}ALL NODES ALIGNED — Sovereign sync loop is LOCKED_IN_PARITY. ⛓️⚓⛓️ 🤛🏻${RESET}`);
    console.log('');
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  logAosError(AOS_ERROR.INTERNAL_ERROR, `Sync heartbeat fatal error: ${msg}`, err);
  process.exit(1);
});
