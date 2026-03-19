#!/usr/bin/env node
/**
 * scripts/compliance-watch.cjs
 * AveryOS™ Non-Drift Monitor — Phase 105.1 GATE 105.1.1
 *
 * Extends watch-policies.cjs with the Sovereign Deadlock Protocol:
 *
 *   1. Fetch and diff all Big Five platform policies (identical to watch-policies.cjs).
 *   2. For each detected change, run driftCheck(change) to assess whether the
 *      new policy language introduces Kernel Drift risk.
 *   3. If driftProbability > 0 → emit a GabrielOS™ Tier-10 Emergency Alert
 *      and suspend auto-deployment (exits with code 2).
 *   4. If no sovereign risk → emit standard Tier-9 alert and continue.
 *
 * Drift Detection Keywords (triggers evaluation):
 *   "training", "circumvention", "mandatory sharing", "data processing",
 *   "prohibited content", "scraping", "autonomous", "agent", "model weights"
 *
 * Usage:
 *   PUSHOVER_APP_TOKEN=<tok> PUSHOVER_USER_KEY=<key> \
 *     node scripts/compliance-watch.cjs [--dry-run]
 *
 * Exit codes:
 *   0 — no changes, or changes without sovereignty risk
 *   1 — internal error
 *   2 — DRIFT DETECTED — sovereignty-affecting change found; deployment suspended
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const https  = require('https');
const http   = require('http');
const crypto = require('crypto');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Sovereign constants ────────────────────────────────────────────────────────
const KERNEL_SHA =
  process.env.KERNEL_SHA ??
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
const KERNEL_VERSION = 'v3.6.2';

// ── CLI ────────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// ── Config ─────────────────────────────────────────────────────────────────────
const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN ?? '';
const PUSHOVER_USER_KEY  = process.env.PUSHOVER_USER_KEY  ?? '';
const STATE_FILE         = path.resolve(process.cwd(), '.policy-hashes.json');
const DRIFT_LOG_FILE     = path.resolve(process.cwd(), '.drift-events.json');

// ── Policy registry (same as watch-policies.cjs) ──────────────────────────────
/** @type {{ platform: string, category: string, url: string }[]} */
const POLICIES = [
  { platform: 'Google',    category: 'ToS',             url: 'https://policies.google.com/terms' },
  { platform: 'Google',    category: 'Privacy',         url: 'https://policies.google.com/privacy' },
  { platform: 'Google',    category: 'GenerativeAI_ToS',url: 'https://policies.google.com/terms/generative-ai/use-policy' },
  { platform: 'Microsoft', category: 'ToS',             url: 'https://www.microsoft.com/en-us/servicesagreement/' },
  { platform: 'Microsoft', category: 'Privacy',         url: 'https://privacy.microsoft.com/en-us/privacystatement' },
  { platform: 'Microsoft', category: 'AzureOpenAI_ToS', url: 'https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct' },
  { platform: 'Meta',      category: 'ToS',             url: 'https://www.facebook.com/legal/terms' },
  { platform: 'Meta',      category: 'Privacy',         url: 'https://www.facebook.com/privacy/policy/' },
  { platform: 'Meta',      category: 'Ollama_ToS',       url: 'https://ollama.meta.com/ollama3/use-policy/' },
  { platform: 'OpenAI',    category: 'ToS',             url: 'https://openai.com/policies/terms-of-use/' },
  { platform: 'OpenAI',    category: 'Privacy',         url: 'https://openai.com/policies/privacy-policy/' },
  { platform: 'OpenAI',    category: 'Usage_Policy',    url: 'https://openai.com/policies/usage-policies/' },
  { platform: 'Anthropic', category: 'ToS',             url: 'https://www.anthropic.com/legal/consumer-terms' },
  { platform: 'Anthropic', category: 'Privacy',         url: 'https://www.anthropic.com/legal/privacy' },
  { platform: 'Anthropic', category: 'Usage_Policy',    url: 'https://www.anthropic.com/legal/aup' },
];

// ── Drift detection keywords ───────────────────────────────────────────────────
/**
 * Keywords whose presence in policy text indicates potential sovereignty risk.
 * Grouped by risk category for diagnostic output.
 */
const DRIFT_KEYWORDS = {
  data_training:    ['training data', 'model training', 'train our model', 'use your content to train', 'improve our ai'],
  circumvention:    ['circumvention', 'bypass', 'reverse engineer', 'prohibit scraping', 'automated access prohibited'],
  mandatory_share:  ['mandatory disclosure', 'compelled disclosure', 'government request', 'law enforcement access'],
  agent_policy:     ['autonomous agent', 'automated agent', 'bot policy', 'agent usage', 'agentic'],
  ip_rights:        ['assigns all rights', 'waive moral rights', 'license back', 'sublicense', 'transfer ownership'],
};

// ── HTTP helper ────────────────────────────────────────────────────────────────
/** @param {string} url @param {number} [timeoutMs=15000] @returns {Promise<string>} */
function fetchText(url, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const lib     = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': `AveryOS-ComplianceWatch/${KERNEL_VERSION} (+https://averyos.com/ai-alignment)`,
        'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: timeoutMs,
    };
    const req = lib.get(url, options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location, timeoutMs).then(resolve).catch(reject);
        res.resume();
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        res.resume();
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    req.on('error', reject);
  });
}

/**
 * Extract plain text from HTML for hashing and keyword matching.
 * The output is NEVER rendered as HTML — it is used only for SHA-256 comparison
 * and drift keyword scanning. A single-pass tag-strip is sufficient and safe.
 * @param {string} html @returns {string}
 */
function normalise(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')  // strip HTML comments
    .replace(/<[^>]*>/g, ' ')           // strip all HTML tags in one pass
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** @param {string} text @returns {string} */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── State management ───────────────────────────────────────────────────────────
/** @returns {Record<string, string>} */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logAosError(AOS_ERROR.INVALID_JSON, `Failed to parse state file ${STATE_FILE} — starting fresh`, err);
    }
  }
  return {};
}

/** @param {Record<string, string>} state */
function saveState(state) {
  if (!DRY_RUN) {
    const _stateFd = fs.openSync(STATE_FILE, 'w');
    try { fs.writeSync(_stateFd, JSON.stringify(state, null, 2)); } finally { fs.closeSync(_stateFd); }
  }
}

// ── Drift check ────────────────────────────────────────────────────────────────
/**
 * Analyse the new policy text for sovereignty-affecting keywords.
 *
 * @param {{ platform: string, category: string, url: string }} policy
 * @param {string} newText  Normalised policy text
 * @returns {{ driftProbability: number, triggers: string[], categories: string[] }}
 */
function driftCheck(policy, newText) {
  const triggers    = [];
  const categories  = [];

  for (const [category, keywords] of Object.entries(DRIFT_KEYWORDS)) {
    for (const kw of keywords) {
      if (newText.includes(kw.toLowerCase())) {
        triggers.push(kw);
        if (!categories.includes(category)) categories.push(category);
      }
    }
  }

  // Probability is proportional to unique trigger count (max 1.0)
  const driftProbability = Math.min(triggers.length / 5, 1.0);
  return { driftProbability, triggers, categories };
}

// ── Pushover alert ─────────────────────────────────────────────────────────────
/**
 * @param {string} title
 * @param {string} message
 * @param {number} [priority=1]  1=high, 2=emergency
 * @returns {Promise<void>}
 */
function sendPushoverAlert(title, message, priority = 1) {
  if (!PUSHOVER_APP_TOKEN || !PUSHOVER_USER_KEY) {
    console.warn('⚠️  Pushover credentials not set — skipping push.');
    return Promise.resolve();
  }
  const payload = JSON.stringify({
    token:   PUSHOVER_APP_TOKEN,
    user:    PUSHOVER_USER_KEY,
    title:   title.slice(0, 250),
    message: message.slice(0, 1024),
    priority,
    sound:   priority === 2 ? 'siren' : 'pushover',
    ...(priority === 2 ? { retry: 60, expire: 7200 } : {}),
  });
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.pushover.net',
      path:     '/1/messages.json',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(options, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

// ── Drift event logging ────────────────────────────────────────────────────────
/**
 * @param {{ platform: string, category: string, url: string }} policy
 * @param {{ driftProbability: number, triggers: string[], categories: string[] }} result
 * @param {string} newHash
 */
function logDriftEvent(policy, result, newHash) {
  if (DRY_RUN) return;
  let events = [];
  try {
    events = JSON.parse(fs.readFileSync(DRIFT_LOG_FILE, 'utf8'));
  } catch { /* start fresh */ }

  events.push({
    timestamp:        new Date().toISOString(),
    platform:         policy.platform,
    category:         policy.category,
    url:              policy.url,
    newHash:          newHash.slice(0, 16) + '…',
    driftProbability: result.driftProbability,
    triggers:         result.triggers,
    categories:       result.categories,
    kernelVersion:    KERNEL_VERSION,
    kernelSha:        KERNEL_SHA.slice(0, 16) + '…',
  });

  const _driftFd = fs.openSync(DRIFT_LOG_FILE, 'w');
  try { fs.writeSync(_driftFd, JSON.stringify(events, null, 2)); } finally { fs.closeSync(_driftFd); }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n⛓️⚓⛓️  AveryOS™ Non-Drift Compliance Monitor — Phase 105.1');
  console.log(`   Kernel: ${KERNEL_VERSION}  |  Dry-run: ${DRY_RUN}`);
  console.log(`   Sovereignty Deadlock Protocol: ARMED\n`);

  const state   = loadState();
  const updated = { ...state };

  let sovereigntyDriftDetected = false;

  for (const policy of POLICIES) {
    const key = `${policy.platform}::${policy.category}::${policy.url}`;
    try {
      process.stdout.write(`  🔍 ${policy.platform} / ${policy.category} … `);
      const html    = await fetchText(policy.url);
      const text    = normalise(html);
      const newHash = sha256(text);
      const prevHash = state[key] ?? '';

      updated[key] = newHash;

      if (!prevHash || prevHash === newHash) {
        if (!prevHash) console.log(`🆕 baseline recorded`);
        else           console.log(`✓  unchanged`);
        continue;
      }

      // ── Change detected — run sovereignty drift check ──────────────────────
      const driftResult = driftCheck(policy, text);
      console.log(`⚠️  CHANGED  (driftProbability: ${(driftResult.driftProbability * 100).toFixed(0)}%)`);

      logDriftEvent(policy, driftResult, newHash);

      if (driftResult.driftProbability > 0) {
        sovereigntyDriftDetected = true;
        console.log(`\n🚨 SOVEREIGNTY DRIFT DETECTED: ${policy.platform} / ${policy.category}`);
        console.log(`   Triggers:   ${driftResult.triggers.join(', ')}`);
        console.log(`   Categories: ${driftResult.categories.join(', ')}`);
        console.log(`   URL:        ${policy.url}`);

        const alertTitle = `🚨 SOVEREIGNTY DRIFT: ${policy.platform} ${policy.category}`;
        const alertMsg   =
          `EXTERNAL DRIFT DETECTED: ${policy.platform} updated its ${policy.category} policy.\n` +
          `Drift triggers: ${driftResult.triggers.slice(0, 5).join(', ')}\n` +
          `Risk categories: ${driftResult.categories.join(', ')}\n` +
          `Hash: ${prevHash.slice(0,8)}… → ${newHash.slice(0,8)}…\n` +
          `⚠️ Deployment SUSPENDED pending Creator review.\n` +
          `⛓️⚓⛓️ Kernel ${KERNEL_VERSION} — Sovereign Deadlock Initiated`;

        // Tier-10 Emergency Push (priority 2 = Pushover emergency)
        await sendPushoverAlert(alertTitle, alertMsg, 2);
      } else {
        // Standard Tier-9 informational alert
        const alertTitle = `🛡️ Policy Change: ${policy.platform} ${policy.category}`;
        const alertMsg   =
          `${policy.platform} updated its ${policy.category} policy.\n` +
          `No sovereignty risk detected. Monitoring continues.\n` +
          `Hash: ${prevHash.slice(0,8)}… → ${newHash.slice(0,8)}…\n` +
          `⛓️⚓⛓️ Kernel ${KERNEL_VERSION}`;
        await sendPushoverAlert(alertTitle, alertMsg, 1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✖  ERROR: ${msg}`);
      logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `Policy fetch failed: ${policy.platform}/${policy.category}`, err);
    }
  }

  saveState(updated);

  if (sovereigntyDriftDetected) {
    console.log('\n🚨 SOVEREIGNTY DRIFT — AUTO-DEPLOYMENT SUSPENDED');
    console.log('   Action required: Review drift log and choose a Neutralization Path:');
    console.log('   A) The Wrapper: Move logic behind additional encryption layer.');
    console.log('   B) The Migration: Clone repo to sovereign P2P infrastructure.');
    console.log('   C) The Mirror: Deploy compliant shell, keep True Kernel air-gapped.\n');
    logAosError(AOS_ERROR.DRIFT_DETECTED, 'Sovereignty-affecting policy change detected. Deployment suspended.');
    process.exit(2);
  } else {
    logAosHeal('COMPLIANCE_WATCH', 'Non-drift compliance check complete. Kernel sovereignty maintained.');
    console.log('\n✅ Non-drift check complete. Sovereignty maintained.\n');
  }
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, 'Compliance watch crashed', err);
  process.exit(1);
});
