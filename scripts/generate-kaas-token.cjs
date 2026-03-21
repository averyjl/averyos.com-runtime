#!/usr/bin/env node
/**
 * AveryOS™ KaaS Token Generator
 *
 * Issues RS256-signed JWTs for Verified Ingestors (White-Hat KaaS partners)
 * against the AveryOS OIDC/JWKS stack at api.averyos.com.
 *
 * Usage:
 *   node scripts/generate-kaas-token.cjs "<Partner Name>" [--ttl <seconds>]
 *
 * Options:
 *   <Partner Name>   Subject claim — the verified partner's name (required)
 *   --ttl <seconds>  Token lifetime in seconds (default: 3600 = 1 hour)
 *
 * Key resolution order (first match wins):
 *   1. AVERYOS_KAAS_PRIVATE_KEY_PATH env var
 *   2. AVERYOS_KAAS_PRIVATE_KEY env var (raw PEM string)
 *   3. Default local PEM path: C:\Users\Jason Lee Avery\.ssh\averyos_private.pem
 *      (falls back to ~/.ssh/averyos_private.pem on non-Windows hosts)
 *
 * Environment variables (also loaded from .env in cwd):
 *   AVERYOS_KAAS_PRIVATE_KEY_PATH  Path to RSA private key PEM file
 *   AVERYOS_KAAS_PRIVATE_KEY       Raw PEM string (alternative to file path)
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Load .env if dotenv is available (best-effort; not required)
try {
  require('dotenv').config();
} catch (_) {
  // dotenv unavailable — rely on shell environment variables
}

const jwt = require('jsonwebtoken');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ---------------------------------------------------------------------------
// Sovereign constants — NEVER hardcode outside lib/sovereignConstants.ts;
// scripts duplicate only what they must for standalone execution.
// ---------------------------------------------------------------------------

/** Full SHA-512 Root0 kernel anchor (128 hex chars — do NOT truncate). */
const KERNEL_SHA =
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const KERNEL_VERSION = 'v3.6.2';
const KID            = 'averyos-sovereign-key-v3.6.2';
const ISSUER         = 'https://api.averyos.com';
const AUDIENCE       = 'averyos-kaas-network';
const SCOPE          = 'openid sovereign_alignment kaas_license';
const TARI_THRESHOLD = 10000; // USD maintenance trigger

/**
 * Default Windows PEM path.
 * This specific path is required for alignment with the Node-02 environment
 * owned by Jason Lee Avery (ROOT0). Override via AVERYOS_KAAS_PRIVATE_KEY_PATH
 * if you are running on a different Windows account or machine.
 */
const WINDOWS_DEFAULT_KEY_PATH = 'C:\\Users\\Jason Lee Avery\\.ssh\\averyos_private.pem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the RSA private key PEM string from environment or default paths.
 * @returns {string} PEM-encoded RSA private key
 */
function resolvePrivateKey() {
  // 1. Explicit file path via env var
  const envPath = process.env.AVERYOS_KAAS_PRIVATE_KEY_PATH;
  if (envPath) {
    const resolved = path.resolve(envPath);
    if (!fs.existsSync(resolved)) {
      logAosError(
        AOS_ERROR.VAULT_NOT_CONFIGURED,
        `AVERYOS_KAAS_PRIVATE_KEY_PATH points to a non-existent file: ${resolved}`,
      );
      process.exit(1);
    }
    logAosHeal('Key loaded from AVERYOS_KAAS_PRIVATE_KEY_PATH env var.');
    return fs.readFileSync(resolved, 'utf8');
  }

  // 2. Raw PEM string via env var
  const envPem = process.env.AVERYOS_KAAS_PRIVATE_KEY;
  if (envPem) {
    logAosHeal('Key loaded from AVERYOS_KAAS_PRIVATE_KEY env var.');
    return envPem.replace(/\\n/g, '\n');
  }

  // 3. Default platform-aware path
  const defaultPath = os.platform() === 'win32'
    ? WINDOWS_DEFAULT_KEY_PATH
    : path.join(os.homedir(), '.ssh', 'averyos_private.pem');

  if (!fs.existsSync(defaultPath)) {
    logAosError(
      AOS_ERROR.VAULT_NOT_CONFIGURED,
      `RSA private key not found at default path: ${defaultPath}\n` +
      '  Set AVERYOS_KAAS_PRIVATE_KEY_PATH or AVERYOS_KAAS_PRIVATE_KEY to override.',
    );
    process.exit(1);
  }

  logAosHeal(`Key loaded from default path: ${defaultPath}`);
  return fs.readFileSync(defaultPath, 'utf8');
}

/**
 * Parses CLI arguments.
 * @returns {{ partnerName: string, ttl: number }}
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith('--')) {
    console.error(
      '\n❌  Usage: node scripts/generate-kaas-token.cjs "<Partner Name>" [--ttl <seconds>]\n',
    );
    process.exit(1);
  }

  const partnerName = args[0].trim();
  if (!partnerName) {
    logAosError(AOS_ERROR.MISSING_FIELD, 'Partner name (sub) must not be empty.');
    process.exit(1);
  }

  let ttl = 3600; // default 1 hour
  const ttlIdx = args.indexOf('--ttl');
  if (ttlIdx !== -1) {
    const ttlVal = parseInt(args[ttlIdx + 1], 10);
    if (isNaN(ttlVal) || ttlVal <= 0) {
      logAosError(AOS_ERROR.MISSING_FIELD, '--ttl must be a positive integer (seconds).');
      process.exit(1);
    }
    ttl = ttlVal;
  }

  return { partnerName, ttl };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { partnerName, ttl } = parseArgs();
  const privateKey = resolvePrivateKey();

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss:                    ISSUER,
    sub:                    partnerName,
    aud:                    AUDIENCE,
    iat:                    now,
    exp:                    now + ttl,
    scope:                  SCOPE,
    'x-averyos-kernel-sha': KERNEL_SHA,
    tari_threshold:         TARI_THRESHOLD,
  };

  const options = {
    algorithm: 'RS256',
    keyid:     KID,
  };

  let token;
  try {
    token = jwt.sign(payload, privateKey, options);
  } catch (err) {
    logAosError(AOS_ERROR.INVALID_AUTH, `JWT signing failed: ${err.message}`, err);
    process.exit(1);
  }

  console.log(`\n⛓️⚓⛓️  AveryOS™ KaaS Token — ${KERNEL_VERSION}\n`);
  console.log('Partner (sub)   :', partnerName);
  console.log('Audience        :', AUDIENCE);
  console.log('Scope           :', SCOPE);
  console.log('Kernel SHA-512  :', KERNEL_SHA);
  console.log(`TARI threshold  : $${TARI_THRESHOLD.toLocaleString()} USD`);
  console.log(`Expires in      : ${ttl}s (${(ttl / 3600).toFixed(2)}h)`);
  console.log('\n── Encoded JWT ──────────────────────────────────────────────────────────\n');
  console.log(token);
  console.log('\n─────────────────────────────────────────────────────────────────────────');
  console.log('\n🤜🏻\n⛓️⚓⛓️\n');
}

main();
