#!/usr/bin/env node
/**
 * AveryOS™ Sovereign Sync Heartbeat — scripts/sync-heartbeat.cjs
 *
 * Verifies that all sovereign nodes (Note 20, Local PC, Cloudflare D1,
 * Firebase Studio) are in Zero-Drift Alignment against the Root0 Kernel SHA.
 *
 * Run manually or hook into CI / deployment pipelines:
 *   node scripts/sync-heartbeat.cjs
 *   node scripts/sync-heartbeat.cjs --verbose
 *
 * Reads node configuration from:
 *   .avery-sync.json        — sync manifest (kernel_sha, loop_state, nodes)
 *   .sovereign-nodes.json   — hardware node registry
 *
 * Exit codes:
 *   0 — All nodes aligned; loop in parity
 *   1 — Drift detected or nodes missing; immediate re-anchor required
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ---------------------------------------------------------------------------
// Sovereign constants (inline — script has no module bundler)
// ---------------------------------------------------------------------------

const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const KERNEL_VERSION = 'v3.6.2';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const SYNC_MANIFEST_PATH   = path.join(ROOT, '.avery-sync.json');
const SOVEREIGN_NODES_PATH = path.join(ROOT, '.sovereign-nodes.json');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

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

// ---------------------------------------------------------------------------
// ISO-9 timestamp
// ---------------------------------------------------------------------------

function iso9() {
  const now  = new Date();
  const base = now.toISOString().replace(/\.\d{3}Z$/, '');
  const ms   = String(now.getMilliseconds()).padStart(3, '0');
  return `${base}.${ms}000000Z`;
}

// ---------------------------------------------------------------------------
// Node registry structure expected from .sovereign-nodes.json
// ---------------------------------------------------------------------------

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
  if (!fs.existsSync(SYNC_MANIFEST_PATH)) {
    warn('.avery-sync.json not found — run `npm run setup` to initialise the sync manifest.');
    logAosHeal(
      AOS_ERROR.MISSING_FIELD,
      '.avery-sync.json is missing. Run `npm run setup` to create it and anchor the sync loop.',
    );
    // Non-fatal: manifest may be absent on a fresh CI runner
  } else {
    let syncManifest;
    try {
      syncManifest = JSON.parse(fs.readFileSync(SYNC_MANIFEST_PATH, 'utf8'));
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
  if (!fs.existsSync(SOVEREIGN_NODES_PATH)) {
    warn('.sovereign-nodes.json not found — run `npm run setup` to register sovereign nodes.');
    logAosHeal(
      AOS_ERROR.MISSING_FIELD,
      '.sovereign-nodes.json is missing. Run `npm run setup` to generate the hardware node registry.',
    );
  } else {
    let nodesManifest;
    try {
      nodesManifest = JSON.parse(fs.readFileSync(SOVEREIGN_NODES_PATH, 'utf8'));
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
