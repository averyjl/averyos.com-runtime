/**
 * AveryOS™ Sovereign Error Logger — Script Edition (CommonJS)
 *
 * Provides RCA (Root Cause Analysis) + actionable error logging for
 * all Node.js scripts under scripts/. Mirrors the error catalogue in
 * lib/sovereignError.ts so that scripts and API routes speak the same
 * error language.
 *
 * Usage:
 *   const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');
 *   logAosError(AOS_ERROR.DB_QUERY_FAILED, err.message, err);
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const BOLD   = '\x1b[1m';

const AOS_ERROR = {
  MISSING_AUTH:         'MISSING_AUTH',
  INVALID_AUTH:         'INVALID_AUTH',
  VAULT_NOT_CONFIGURED: 'VAULT_NOT_CONFIGURED',
  INVALID_JSON:         'INVALID_JSON',
  MISSING_FIELD:        'MISSING_FIELD',
  INVALID_FIELD:        'INVALID_FIELD',
  INVALID_IP:           'INVALID_IP',
  DB_UNAVAILABLE:       'DB_UNAVAILABLE',
  DB_QUERY_FAILED:      'DB_QUERY_FAILED',
  KV_UNAVAILABLE:       'KV_UNAVAILABLE',
  BINDING_MISSING:      'BINDING_MISSING',
  NOT_FOUND:            'NOT_FOUND',
  LICENSE_INVALID:      'LICENSE_INVALID',
  TOKEN_EXPIRED:        'TOKEN_EXPIRED',
  STRIPE_ERROR:         'STRIPE_ERROR',
  EXTERNAL_API_ERROR:   'EXTERNAL_API_ERROR',
  BTC_ANCHOR_FAILED:    'BTC_ANCHOR_FAILED',
  INTERNAL_ERROR:       'INTERNAL_ERROR',
  DRIFT_DETECTED:       'DRIFT_DETECTED',
};

/** RCA registry: human-readable diagnosis + actionable recovery steps per code */
const RCA = {
  [AOS_ERROR.MISSING_AUTH]: {
    diagnosis: 'No authorisation token was provided.',
    steps: [
      'Set VAULT_PASSPHRASE in your .env or environment before running the script.',
      'Pass the token via --token flag or VAULT_PASSPHRASE env variable.',
    ],
  },
  [AOS_ERROR.INVALID_AUTH]: {
    diagnosis: 'The provided authorisation token does not match the Sovereign Passphrase.',
    steps: [
      'Verify VAULT_PASSPHRASE matches the value in your Cloudflare Worker secrets.',
      'Re-retrieve the passphrase from /vault-gate.',
    ],
  },
  [AOS_ERROR.VAULT_NOT_CONFIGURED]: {
    diagnosis: 'The VAULT_PASSPHRASE secret has not been set.',
    steps: [
      'Set VAULT_PASSPHRASE in your .env file.',
      'Or set it for the Cloudflare Worker: `wrangler secret put VAULT_PASSPHRASE`.',
    ],
  },
  [AOS_ERROR.INVALID_IP]: {
    diagnosis: 'The provided IP address is not valid.',
    steps: [
      'Use a standard dotted-decimal IPv4 (e.g. 203.0.113.42) or compressed IPv6 format.',
      'Pass it via --ip flag.',
    ],
  },
  [AOS_ERROR.DB_UNAVAILABLE]: {
    diagnosis: 'The D1 database is not reachable from this script.',
    steps: [
      'Ensure WRANGLER_D1_ID is set and matches the D1 database ID in Cloudflare.',
      'Run: `wrangler d1 list` to verify the database exists.',
      'Check you are authenticated: `wrangler whoami`.',
    ],
  },
  [AOS_ERROR.DB_QUERY_FAILED]: {
    diagnosis: 'A D1 query failed at runtime.',
    steps: [
      'Check the error detail for the specific SQL or wrangler message.',
      'Verify the table exists: `wrangler d1 execute <db> --command "SELECT name FROM sqlite_master WHERE type=\'table\'"`.',
      'Apply missing migrations: `wrangler d1 migrations apply <db>`.',
    ],
  },
  [AOS_ERROR.STRIPE_ERROR]: {
    diagnosis: 'A Stripe API call failed.',
    steps: [
      'Ensure STRIPE_SECRET_KEY is set and is the correct live/test key.',
      'Check the Stripe dashboard for error logs.',
    ],
  },
  [AOS_ERROR.EXTERNAL_API_ERROR]: {
    diagnosis: 'An external API call failed.',
    steps: [
      'Check your internet connection.',
      'The external service may be temporarily down — retry in a few minutes.',
      'Check the error detail for the specific HTTP status.',
    ],
  },
  [AOS_ERROR.BTC_ANCHOR_FAILED]: {
    diagnosis: 'Bitcoin block height could not be fetched from BlockCypher.',
    steps: [
      'Set BLOCKCHAIN_API_KEY to avoid BlockCypher rate limits.',
      'The evidence bundle will still be generated with an offline anchor — this is acceptable.',
    ],
  },
  [AOS_ERROR.INTERNAL_ERROR]: {
    diagnosis: 'An unexpected internal error occurred.',
    steps: [
      'Check the full stack trace above for the root cause.',
      'Open a Sovereign Support ticket at /compliance if the issue persists.',
    ],
  },
  [AOS_ERROR.DRIFT_DETECTED]: {
    diagnosis: 'Kernel drift detected.',
    steps: [
      'Verify the current KERNEL_SHA in lib/sovereignConstants.ts matches VaultBridge/GoldenLockArtifact.lock.json.',
      'Re-deploy from the canonical branch.',
    ],
  },
};

/**
 * Log a Sovereign RCA error to stderr with diagnosis and actionable recovery steps.
 * @param {string} code — One of the AOS_ERROR constants
 * @param {string} detail — The raw error message
 * @param {Error|unknown} [cause] — The original Error object (optional, for stack traces)
 */
function logAosError(code, detail, cause) {
  const rca = RCA[code] ?? RCA[AOS_ERROR.INTERNAL_ERROR];
  console.error('');
  console.error(`${RED}${BOLD}❌ [AOS ERROR] ${code}${RESET}`);
  console.error(`${YELLOW}   Diagnosis  : ${rca.diagnosis}${RESET}`);
  console.error(`${CYAN}   Detail     : ${detail}${RESET}`);
  if (cause instanceof Error && cause.stack) {
    const shortStack = cause.stack.split('\n').slice(0, 4).join('\n             ');
    console.error(`${CYAN}   Stack      : ${shortStack}${RESET}`);
  }
  if (rca.steps && rca.steps.length > 0) {
    console.error(`${GREEN}   ── Actionable Steps ──${RESET}`);
    rca.steps.forEach((step, i) => {
      console.error(`${GREEN}   ${i + 1}. ${step}${RESET}`);
    });
  }
  console.error('');
}

/**
 * Log an auto-heal notice (when a recoverable error was handled automatically).
 * @param {string} code — The AOS error code that was healed
 * @param {string} action — Description of the recovery action taken
 */
function logAosHeal(code, action) {
  console.warn(`${YELLOW}🔄 [AOS AUTO-HEAL] ${code} — ${action}${RESET}`);
}

/**
 * Classify a raw Error into an AOS error code for consistent logging.
 * @param {Error|unknown} err
 * @returns {string} AOS_ERROR code
 */
function classifyError(err) {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('stripe'))                                          return AOS_ERROR.STRIPE_ERROR;
  if (msg.includes('d1') || msg.includes('sqlite'))                   return AOS_ERROR.DB_QUERY_FAILED;
  if (msg.includes('blockcypher') || msg.includes('block height'))    return AOS_ERROR.BTC_ANCHOR_FAILED;
  if (msg.includes('unauthorized') || msg.includes('401'))            return AOS_ERROR.INVALID_AUTH;
  if (msg.includes('not found') || msg.includes('404'))               return AOS_ERROR.NOT_FOUND;
  if (msg.includes('expired'))                                        return AOS_ERROR.TOKEN_EXPIRED;
  if (msg.includes('json') || msg.includes('parse'))                  return AOS_ERROR.INVALID_JSON;
  if (msg.includes('ip') || msg.includes('address'))                  return AOS_ERROR.INVALID_IP;
  return AOS_ERROR.INTERNAL_ERROR;
}

module.exports = { AOS_ERROR, logAosError, logAosHeal, classifyError };
