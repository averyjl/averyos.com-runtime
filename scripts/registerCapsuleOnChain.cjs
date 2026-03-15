#!/usr/bin/env node
/**
 * scripts/registerCapsuleOnChain.cjs
 *
 * AveryOS™ BTC/IPFS On-Chain Registration — Gate 6 (Sovereign Roadmap)
 *
 * Registers a .aoscap capsule SHA-512 fingerprint on-chain by:
 *   1. Computing or accepting a SHA-512 hash of the capsule payload.
 *   2. Uploading the capsule JSON to IPFS via the configured pinning service
 *      (Pinata / nft.storage / web3.storage — set via env vars).
 *   3. Writing an OP_RETURN Bitcoin transaction embedding the SHA-512 and
 *      IPFS CID via the Blockstream Esplora API (testnet or mainnet).
 *   4. Updating the capsule record in the local Cloudflare D1 database (via
 *      wrangler d1 execute) with the btc_anchor_sha and ipfs_cid fields.
 *
 * Usage:
 *   node scripts/registerCapsuleOnChain.cjs --capsule <path.aoscap>
 *   node scripts/registerCapsuleOnChain.cjs --capsule <path.aoscap> --dry-run
 *   node scripts/registerCapsuleOnChain.cjs --sha512 <hash> --ipfs-cid <cid> --dry-run
 *
 * Options:
 *   --capsule <file>    Path to the .aoscap capsule JSON file.
 *   --sha512 <hash>     Provide a pre-computed SHA-512 hex (skips file read).
 *   --ipfs-cid <cid>    Provide a pre-pinned IPFS CID (skips IPFS upload).
 *   --network <net>     Bitcoin network: "mainnet" | "testnet" (default: testnet).
 *   --db <name>         D1 database name (default: averyos_kernel_db).
 *   --dry-run           Print all steps but do NOT broadcast or write to D1.
 *   --verbose           Print detailed progress.
 *
 * Required environment variables (for full on-chain registration):
 *   PINATA_JWT           — Pinata JWT for IPFS pinning (or WEB3_STORAGE_TOKEN)
 *   BTC_PRIVATE_KEY_WIF  — Bitcoin private key in WIF format (for signing)
 *   BTC_UTXO_TXID        — Funding UTXO transaction ID
 *   BTC_UTXO_VOUT        — Funding UTXO output index
 *   BTC_UTXO_VALUE_SAT   — Funding UTXO value in satoshis
 *   BTC_CHANGE_ADDRESS   — Bitcoin change address
 *
 * Exit codes:
 *   0 — Registration successful (or dry-run completed)
 *   1 — Script error / fatal failure
 *   2 — Capsule file not found
 *   3 — IPFS pinning failed
 *   4 — Bitcoin broadcast failed
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');
const { execSync } = require('child_process');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const KERNEL_VERSION    = 'v3.6.2';
// First 16 chars of the kernel SHA for display
const KERNEL_SHA_PREFIX = 'cf83e1357eefb8bd';

// BTC OP_RETURN prefix: "AVERYOS" in ASCII hex (7 bytes)
const OP_RETURN_PREFIX = '41564552594f53'; // "AVERYOS"

// IPFS pinning endpoints
const PINATA_PIN_URL    = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const ESPLORA_MAINNET   = 'https://blockstream.info/api';
const ESPLORA_TESTNET   = 'https://blockstream.info/testnet/api';

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const VERBOSE    = args.includes('--verbose');
const DRY_RUN    = args.includes('--dry-run');
const NETWORK    = args.includes('--network')
  ? args[args.indexOf('--network') + 1] ?? 'testnet'
  : 'testnet';
const DB_NAME    = args.includes('--db')
  ? args[args.indexOf('--db') + 1] ?? 'averyos_kernel_db'
  : 'averyos_kernel_db';

let CAPSULE_PATH  = null;
let SHA512_INPUT  = null;
let IPFS_CID      = null;

if (args.includes('--capsule'))  CAPSULE_PATH = args[args.indexOf('--capsule')  + 1];
if (args.includes('--sha512'))   SHA512_INPUT = args[args.indexOf('--sha512')   + 1];
if (args.includes('--ipfs-cid')) IPFS_CID     = args[args.indexOf('--ipfs-cid') + 1];

// ── Theme helpers ─────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const GOLD   = '\x1b[33m';
const RESET  = '\x1b[0m';

function info(msg)    { if (VERBOSE) console.log(`${CYAN}[onchain]${RESET} ${msg}`); }
function success(msg) { console.log(`${GREEN}✔${RESET}  ${msg}`); }
function warn(msg)    { console.warn(`${YELLOW}⚠${RESET}  ${msg}`); }
function fail(msg)    { console.error(`${RED}✘${RESET}  ${msg}`); }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute SHA-512 of a buffer.
 *
 * @param {Buffer} buf
 * @returns {string}
 */
function sha512Hex(buf) {
  return crypto.createHash('sha512').update(buf).digest('hex');
}

/**
 * POST JSON to a URL and return the parsed response.
 *
 * @param {string}  url
 * @param {object}  body
 * @param {object}  headers
 * @returns {Promise<{status: number, body: unknown}>}
 */
function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload    = JSON.stringify(body);
    const parsedUrl  = new URL(url);
    const isHttps    = parsedUrl.protocol === 'https:';
    const mod        = isHttps ? https : http;

    const opts = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (isHttps ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Pin JSON to IPFS via Pinata.
 *
 * @param {object} json     The capsule JSON to pin.
 * @param {string} sha512   SHA-512 of the capsule (used as pin name).
 * @returns {Promise<string>} IPFS CID
 */
async function pinToIpfs(json, sha512) {
  const jwt = process.env.PINATA_JWT ?? process.env.WEB3_STORAGE_TOKEN;
  if (!jwt) {
    warn('PINATA_JWT / WEB3_STORAGE_TOKEN not set — skipping IPFS pinning.');
    return null;
  }

  info('Pinning capsule to IPFS via Pinata…');

  const pinBody = {
    pinataContent:  json,
    pinataMetadata: {
      name: `averyos-capsule-${sha512.slice(0, 16)}`,
      keyvalues: {
        kernel_version: KERNEL_VERSION,
        sha512_prefix:  sha512.slice(0, 16),
        creator_lock:   'Jason Lee Avery',
      },
    },
    pinataOptions: { cidVersion: 1 },
  };

  const res = await postJson(PINATA_PIN_URL, pinBody, {
    Authorization: `Bearer ${jwt}`,
  });

  if (res.status !== 200) {
    fail(`IPFS pinning failed: HTTP ${res.status}`);
    if (VERBOSE) console.log('Pinata response:', JSON.stringify(res.body, null, 2));
    return null;
  }

  const cid = (res.body).IpfsHash;
  if (!cid) {
    fail('IPFS pinning succeeded but IpfsHash missing in response.');
    return null;
  }

  success(`IPFS CID: ${cid}`);
  return cid;
}

/**
 * Build the OP_RETURN data for the BTC transaction.
 * Format: <OP_RETURN_PREFIX (7 bytes)> + <sha512[0:48 hex chars] (24 bytes)>
 *           + <ipfsCidShort (variable, max 80 bytes total)>
 *
 * @param {string} sha512   Full SHA-512 hex.
 * @param {string} cid      IPFS CID string (may be null).
 * @returns {string} Hex-encoded OP_RETURN data (max 80 bytes).
 */
function buildOpReturnData(sha512, cid) {
  // Prefix "AVERYOS" (7 bytes) + SHA-512 first 48 hex chars (24 bytes) = 31 bytes
  // Then fit as much CID as possible up to 80 byte total limit.
  const prefixBuf  = Buffer.from(OP_RETURN_PREFIX, 'hex'); // 7 bytes
  const sha512Buf  = Buffer.from(sha512.slice(0, 48), 'hex'); // 24 bytes

  const remaining  = 80 - prefixBuf.length - sha512Buf.length; // 49 bytes left
  let cidBuf = Buffer.alloc(0);
  if (cid) {
    const cidFull = Buffer.from(cid, 'utf8');
    if (cidFull.length > remaining) {
      warn(`IPFS CID (${cidFull.length} bytes) exceeds OP_RETURN space (${remaining} bytes) — CID will be truncated on-chain.`);
      warn('The truncated CID will not be resolvable. Consider using a shorter CIDv1 or storing the full CID off-chain.');
    }
    cidBuf = cidFull.slice(0, remaining);
  }

  return Buffer.concat([prefixBuf, sha512Buf, cidBuf]).toString('hex');
}

/**
 * Broadcast a raw hex transaction via Blockstream Esplora.
 *
 * @param {string} rawTxHex
 * @returns {Promise<string|null>} txid on success, null on failure
 */
async function broadcastTx(rawTxHex) {
  const base = NETWORK === 'mainnet' ? ESPLORA_MAINNET : ESPLORA_TESTNET;
  const url  = `${base}/tx`;

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const opts = {
      hostname: parsedUrl.hostname,
      port:     443,
      path:     parsedUrl.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'text/plain',
        'Content-Length': Buffer.byteLength(rawTxHex),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data.trim());
        } else {
          fail(`Esplora broadcast failed: HTTP ${res.statusCode} — ${data.trim()}`);
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      fail(`Broadcast network error: ${err.message}`);
      resolve(null);
    });
    req.write(rawTxHex);
    req.end();
  });
}

/**
 * Update D1 with the btc_anchor_sha and ipfs_cid fields.
 * Uses a temporary SQL file with safe literals to avoid injection.
 * Input values are validated to contain only safe characters before use.
 *
 * @param {string} sha512
 * @param {string|null} btcTxid
 * @param {string|null} ipfsCid
 */
function updateD1Record(sha512, btcTxid, ipfsCid) {
  if (DRY_RUN) {
    console.log(
      `${YELLOW}[DRY-RUN]${RESET} Would update D1 record where sha512 LIKE '${sha512.slice(0, 16)}%':`,
      JSON.stringify({ btc_anchor_sha: btcTxid, ipfs_cid: ipfsCid }, null, 2),
    );
    return;
  }

  // ── Input validation: only allow safe characters before SQL interpolation ──
  const HEX_RE   = /^[0-9a-fA-F]{1,128}$/;
  const TXID_RE  = /^[0-9a-fA-F]{64}$/;
  const CID_RE   = /^[A-Za-z0-9+/=._-]{1,128}$/;

  if (!HEX_RE.test(sha512)) {
    warn('sha512 contains unsafe characters — skipping D1 write.');
    return;
  }
  if (btcTxid && !TXID_RE.test(btcTxid)) {
    warn('btcTxid contains unsafe characters — skipping D1 write.');
    return;
  }
  if (ipfsCid && !CID_RE.test(ipfsCid)) {
    warn('ipfsCid contains unsafe characters — skipping D1 write.');
    return;
  }

  if (!btcTxid && !ipfsCid) {
    warn('Neither btc_anchor_sha nor ipfs_cid to update — skipping D1 write.');
    return;
  }

  // Write SQL to a temp file to avoid shell-injection from string interpolation
  const tmpSqlPath = path.join(require('os').tmpdir(), `aos_onchain_${Date.now()}.sql`);
  const sha512Prefix = sha512.slice(0, 16);
  const setClauses = [];
  if (btcTxid) setClauses.push(`btc_anchor_sha = '${btcTxid}'`);
  if (ipfsCid)  setClauses.push(`ipfs_cid = '${ipfsCid}'`);
  const sql = `UPDATE anchor_audit_logs SET ${setClauses.join(', ')} WHERE sha512 LIKE '${sha512Prefix}%';`;

  try {
    fs.writeFileSync(tmpSqlPath, sql, 'utf8');
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --file "${tmpSqlPath}"`,
      { stdio: 'inherit' },
    );
    logAosHeal('D1_UPDATE', `btc_anchor_sha / ipfs_cid written for sha512 prefix ${sha512.slice(0, 16)}`);
    success('D1 record updated with on-chain anchors.');
  } catch (err) {
    logAosError(AOS_ERROR.DB_QUERY_FAILED, `D1 update failed: ${err.message}`, err);
    warn('D1 update failed — record not updated. Run manually if needed.');
  } finally {
    try { fs.unlinkSync(tmpSqlPath); } catch { /* best-effort cleanup */ }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${GOLD}⛓️⚓⛓️  AveryOS™ BTC/IPFS On-Chain Registration${RESET}`);
  console.log(`${GOLD}       Gate 6 · Kernel ${KERNEL_VERSION}${RESET}\n`);

  if (DRY_RUN) warn('DRY-RUN mode — no real transactions will be broadcast.');
  if (NETWORK === 'mainnet') warn('Running on MAINNET — real BTC will be spent.');

  // ── Step 1: Resolve capsule SHA-512 ──────────────────────────────────────
  let sha512 = SHA512_INPUT;
  let capsuleJson = null;

  if (!sha512 && CAPSULE_PATH) {
    if (!fs.existsSync(CAPSULE_PATH)) {
      fail(`Capsule file not found: ${CAPSULE_PATH}`);
      process.exit(2);
    }
    const capsuleBuf = fs.readFileSync(CAPSULE_PATH);
    sha512       = sha512Hex(capsuleBuf);
    try { capsuleJson = JSON.parse(capsuleBuf.toString('utf8')); } catch {}
    success(`Capsule SHA-512: ${sha512.slice(0, 32)}…`);
  }

  if (!sha512) {
    fail('No --capsule or --sha512 provided. Provide at least one.');
    console.log('\nUsage: node scripts/registerCapsuleOnChain.cjs --capsule <path.aoscap>');
    process.exit(1);
  }

  info(`SHA-512: ${sha512}`);
  info(`Network: ${NETWORK}`);

  // ── Step 2: IPFS pinning ─────────────────────────────────────────────────
  let ipfsCid = IPFS_CID;

  if (!ipfsCid && capsuleJson) {
    if (!DRY_RUN) {
      ipfsCid = await pinToIpfs(capsuleJson, sha512);
      if (!ipfsCid) {
        warn('IPFS pinning failed — continuing without IPFS CID.');
      }
    } else {
      console.log(`${YELLOW}[DRY-RUN]${RESET} Would pin capsule JSON to IPFS (Pinata).`);
      ipfsCid = 'bafyDRYRUN000000000000000000000000000000000000000000000000';
    }
  }

  // ── Step 3: Build OP_RETURN data ─────────────────────────────────────────
  const opReturnHex = buildOpReturnData(sha512, ipfsCid);
  info(`OP_RETURN data (hex): ${opReturnHex}`);
  info(`OP_RETURN length: ${opReturnHex.length / 2} bytes`);

  // ── Step 4: Broadcast BTC transaction ────────────────────────────────────
  let btcTxid = null;

  const privateKeyWif = process.env.BTC_PRIVATE_KEY_WIF;
  const utxoTxid      = process.env.BTC_UTXO_TXID;
  const utxoVout      = process.env.BTC_UTXO_VOUT;
  const utxoValueSat  = process.env.BTC_UTXO_VALUE_SAT;
  const changeAddress = process.env.BTC_CHANGE_ADDRESS;

  if (!privateKeyWif || !utxoTxid || !utxoVout || !utxoValueSat || !changeAddress) {
    warn('BTC environment variables not fully configured — skipping Bitcoin broadcast.');
    warn('To enable: set BTC_PRIVATE_KEY_WIF, BTC_UTXO_TXID, BTC_UTXO_VOUT,');
    warn('           BTC_UTXO_VALUE_SAT, BTC_CHANGE_ADDRESS as environment variables.');
    warn('OP_RETURN data prepared — broadcast manually with the hex above.');

    if (DRY_RUN) {
      console.log(`${YELLOW}[DRY-RUN]${RESET} OP_RETURN hex for manual broadcast:`);
      console.log(`  ${opReturnHex}`);
    }
  } else if (!DRY_RUN) {
    // Build and broadcast the raw transaction.
    // NOTE: Raw BTC transaction construction requires a library (bitcoinjs-lib).
    // If bitcoinjs-lib is not installed, print instructions for manual broadcast.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bitcoin = require('bitcoinjs-lib');
      const ECPair  = require('ecpair');
      const ecc     = require('tiny-secp256k1');

      const network = NETWORK === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
      const ECPairFactory = ECPair.ECPairFactory(ecc);
      const keyPair = ECPairFactory.fromWIF(privateKeyWif, network);

      const psbt = new bitcoin.Psbt({ network });
      psbt.addInput({
        hash:  utxoTxid,
        index: parseInt(utxoVout, 10),
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).output,
          value:  parseInt(utxoValueSat, 10),
        },
      });

      const feeEstimateSat = 2000; // conservative fee
      const changeSat      = parseInt(utxoValueSat, 10) - feeEstimateSat;

      if (changeSat < 546) { // dust threshold
        fail('Change output would be below dust threshold — increase UTXO value.');
        process.exit(4);
      }

      // OP_RETURN output
      const opReturnScript = bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        Buffer.from(opReturnHex, 'hex'),
      ]);
      psbt.addOutput({ script: opReturnScript, value: 0 });

      // Change output
      psbt.addOutput({ address: changeAddress, value: changeSat });

      psbt.signInput(0, keyPair);
      psbt.finalizeAllInputs();

      const rawTx = psbt.extractTransaction().toHex();
      info(`Raw transaction built (${rawTx.length / 2} bytes)`);

      btcTxid = await broadcastTx(rawTx);
      if (btcTxid) {
        success(`BTC transaction broadcast: ${btcTxid}`);
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        warn('bitcoinjs-lib / ecpair / tiny-secp256k1 not installed.');
        warn('Run: npm install bitcoinjs-lib ecpair tiny-secp256k1');
        warn('Then re-run this script to broadcast the BTC transaction.');
        warn(`OP_RETURN hex for manual broadcast: ${opReturnHex}`);
      } else {
        logAosError(AOS_ERROR.DB_QUERY_FAILED, `BTC build/broadcast failed: ${err.message}`, err);
        fail(`BTC transaction failed: ${err.message}`);
      }
    }
  } else {
    console.log(`${YELLOW}[DRY-RUN]${RESET} Would broadcast BTC OP_RETURN transaction.`);
    console.log(`  OP_RETURN hex: ${opReturnHex}`);
    btcTxid = 'DRY_RUN_TXID';
  }

  // ── Step 5: Update D1 record ─────────────────────────────────────────────
  updateD1Record(sha512, btcTxid, ipfsCid);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${GOLD}⛓️⚓⛓️  Registration Summary${RESET}`);
  console.log(`  SHA-512:     ${sha512.slice(0, 32)}…`);
  console.log(`  IPFS CID:    ${ipfsCid ?? 'N/A'}`);
  console.log(`  BTC TxID:    ${btcTxid ?? 'N/A'}`);
  console.log(`  Network:     ${NETWORK}`);
  console.log(`  Kernel:      ${KERNEL_VERSION} | ${KERNEL_SHA_PREFIX}…\n`);

  logAosHeal(
    'ON_CHAIN_REGISTRATION',
    `Capsule registered. SHA512: ${sha512.slice(0, 16)}… IPFS: ${ipfsCid ?? 'N/A'} BTC: ${btcTxid ?? 'N/A'}`,
  );

  process.exit(0);
}

main().catch((err) => {
  logAosError(AOS_ERROR.NOT_FOUND, err.message, err);
  fail(`Unexpected error: ${err.message}`);
  process.exit(1);
});
