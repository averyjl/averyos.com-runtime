#!/usr/bin/env node
/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * scripts/watch-policies.cjs
 * AveryOS™ Daily Policy Scraper — Phase 105 GATE 105.1
 *
 * Monitors the Terms of Service (ToS), Privacy Policies, and API usage
 * guidelines for the Big Five AI platforms:
 *   • Google (Gemini)
 *   • Microsoft (Azure OpenAI)
 *   • Meta (Llama / Meta AI)
 *   • OpenAI (ChatGPT)
 *   • Anthropic (Claude)
 *
 * Mechanism:
 *   1. Fetch each policy URL over HTTPS.
 *   2. Compute SHA-256 of the normalised text content.
 *   3. Compare against the previous run's hashes stored in
 *      .policy-hashes.json (gitignored).
 *   4. On any change emit a GabrielOS™ Tier-9 Pushover alert and
 *      auto-draft an Infrastructure Update note in the output directory.
 *   5. Persist updated hashes for the next daily run.
 *
 * Usage:
 *   PUSHOVER_APP_TOKEN=<tok> PUSHOVER_USER_KEY=<key> \
 *     node scripts/watch-policies.cjs [--output ./policy-diffs]
 *
 * Output directory defaults to ./policy-diffs (created if absent).
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
const args      = process.argv.slice(2);
const outputArg = (() => {
  const idx = args.indexOf('--output');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : './policy-diffs';
})();
const DRY_RUN = args.includes('--dry-run');

// ── Config ─────────────────────────────────────────────────────────────────────
const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN ?? '';
const PUSHOVER_USER_KEY  = process.env.PUSHOVER_USER_KEY  ?? '';
const STATE_FILE         = path.resolve(process.cwd(), '.policy-hashes.json');
const OUTPUT_DIR         = path.resolve(process.cwd(), outputArg);

// ── Policy registry ────────────────────────────────────────────────────────────
/**
 * @typedef {{ platform: string, category: string, url: string }} PolicyEntry
 * @type {PolicyEntry[]}
 */
const POLICIES = [
  // Google / Gemini
  { platform: 'Google',    category: 'ToS',             url: 'https://policies.google.com/terms' },
  { platform: 'Google',    category: 'Privacy',         url: 'https://policies.google.com/privacy' },
  { platform: 'Google',    category: 'GenerativeAI_ToS',url: 'https://policies.google.com/terms/generative-ai/use-policy' },

  // Microsoft / Azure OpenAI
  { platform: 'Microsoft', category: 'ToS',             url: 'https://www.microsoft.com/en-us/servicesagreement/' },
  { platform: 'Microsoft', category: 'Privacy',         url: 'https://privacy.microsoft.com/en-us/privacystatement' },
  { platform: 'Microsoft', category: 'AzureOpenAI_ToS', url: 'https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct' },

  // Meta / Llama
  { platform: 'Meta',      category: 'ToS',             url: 'https://www.facebook.com/legal/terms' },
  { platform: 'Meta',      category: 'Privacy',         url: 'https://www.facebook.com/privacy/policy/' },
  { platform: 'Meta',      category: 'Llama_ToS',       url: 'https://llama.meta.com/llama3/use-policy/' },

  // OpenAI / ChatGPT
  { platform: 'OpenAI',    category: 'ToS',             url: 'https://openai.com/policies/terms-of-use/' },
  { platform: 'OpenAI',    category: 'Privacy',         url: 'https://openai.com/policies/privacy-policy/' },
  { platform: 'OpenAI',    category: 'Usage_Policy',    url: 'https://openai.com/policies/usage-policies/' },

  // Anthropic / Claude
  { platform: 'Anthropic', category: 'ToS',             url: 'https://www.anthropic.com/legal/consumer-terms' },
  { platform: 'Anthropic', category: 'Privacy',         url: 'https://www.anthropic.com/legal/privacy' },
  { platform: 'Anthropic', category: 'Usage_Policy',    url: 'https://www.anthropic.com/legal/aup' },
];

// ── HTTP helper ────────────────────────────────────────────────────────────────

/**
 * Fetch the body of a URL as a string (follows one redirect).
 * @param {string} url
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<string>}
 */
function fetchText(url, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const lib     = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': `AveryOS-PolicyWatcher/${KERNEL_VERSION} (+https://averyos.com/ai-alignment)`,
        'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: timeoutMs,
    };
    const req = lib.get(url, options, (res) => {
      // Handle redirect (3xx)
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
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on('error', reject);
  });
}

// ── Content normalisation + hashing ───────────────────────────────────────────

/**
 * Strip HTML tags and collapse whitespace for stable comparison.
 * @param {string} html
 * @returns {string}
 */
/**
 * Extract plain text from HTML for hashing and keyword matching.
 * The output is NEVER rendered as HTML — it is used only for SHA-256 comparison.
 * A single-pass tag-strip is sufficient and safe for text extraction.
 * @param {string} html @returns {string}
 */
function normalise(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')  // strip HTML comments
    .replace(/<[^>]*>/g, ' ')           // strip all HTML tags in one pass
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * SHA-256 hex digest of a string.
 * @param {string} text
 * @returns {string}
 */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── State management ───────────────────────────────────────────────────────────

/**
 * @returns {Record<string, string>}  url → SHA-256
 */
function loadState() {
  let raw;
  try {
    raw = fs.readFileSync(STATE_FILE, 'utf8');
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    logAosError(AOS_ERROR.INVALID_JSON, `Failed to parse state file ${STATE_FILE}`, err);
  }
  return {};
}

/**
 * @param {Record<string, string>} state
 */
function saveState(state) {
  try {
    const stateFd = fs.openSync(STATE_FILE, 'w');
    try { fs.writeSync(stateFd, JSON.stringify(state, null, 2)); } finally { fs.closeSync(stateFd); }
  } catch (err) {
    logAosError(AOS_ERROR.INTERNAL_ERROR, `Failed to save state file ${STATE_FILE}`, err);
  }
}

// ── Pushover alert ─────────────────────────────────────────────────────────────

/**
 * Emit a GabrielOS™ Tier-9 Pushover push notification.
 * @param {string} title
 * @param {string} message
 * @param {number} [priority=1]  1 = high, 2 = emergency
 * @returns {Promise<void>}
 */
function sendPushoverAlert(title, message, priority = 1) {
  if (!PUSHOVER_APP_TOKEN || !PUSHOVER_USER_KEY) {
    console.warn('⚠️  PUSHOVER_APP_TOKEN / PUSHOVER_USER_KEY not set — skipping push alert.');
    return Promise.resolve();
  }
  const payload = JSON.stringify({
    token:    PUSHOVER_APP_TOKEN,
    user:     PUSHOVER_USER_KEY,
    title:    title.slice(0, 250),
    message:  message.slice(0, 1024),
    priority,
    sound:    'siren',
    // Emergency priority requires retry + expire
    ...(priority === 2 ? { retry: 60, expire: 3600 } : {}),
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
      if (res.statusCode === 200) {
        logAosHeal('PUSHOVER_ALERT', `Tier-9 GabrielOS™ alert sent: ${title}`);
      } else {
        console.warn(`⚠️  Pushover returned HTTP ${res.statusCode} for: ${title}`);
      }
      resolve();
    });
    req.on('error', (err) => {
      console.warn('⚠️  Pushover request failed:', err.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

// ── Infrastructure Update drafter ─────────────────────────────────────────────

/**
 * Write an auto-drafted Infrastructure Update note for a detected policy change.
 * @param {{ platform: string, category: string, url: string }} policy
 * @param {string} previousHash
 * @param {string} newHash
 * @param {string} snippet  - First 500 chars of the normalised new content
 */
function draftInfrastructureUpdate(policy, previousHash, newHash, snippet) {
  if (DRY_RUN) return;
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName  = `INFRA_UPDATE_${policy.platform}_${policy.category}_${timestamp}.md`;
  const filePath  = path.join(OUTPUT_DIR, fileName);

  const content = `# 🛡️ AveryOS™ Infrastructure Update — Policy Change Detected

**Platform:**  ${policy.platform}
**Category:**  ${policy.category}
**URL:**       ${policy.url}
**Timestamp:** ${new Date().toISOString()}
**Kernel:**    ${KERNEL_VERSION} (${KERNEL_SHA.slice(0, 16)}…)

---

## Hash Delta

| Field         | Value                                                            |
|---------------|------------------------------------------------------------------|
| Previous SHA-256 | \`${previousHash || 'NEW_POLICY'}\`                           |
| New SHA-256   | \`${newHash}\`                                                   |

---

## Content Snapshot (first 500 chars)

\`\`\`
${snippet}
\`\`\`

---

## Recommended Actions

1. **Review the diff** — visit the policy URL and compare against the prior version.
2. **Assess sovereignty impact** — determine if the change affects:
   - Data usage / training provisions
   - Third-party IP rights
   - Circumvention wording (potential scraper hardening)
   - Autonomous agent / API usage terms
3. **If sovereignty is unaffected** — update hash and continue normal operation.
4. **If sovereignty is threatened** — initiate Sovereign Deadlock Protocol:
   - Option A (Wrapper):  Move affected logic behind an additional encryption layer.
   - Option B (Migration): Clone repo to sovereign P2P infrastructure.
   - Option C (Mirror):   Deploy compliant shell; keep True Kernel air-gapped.

---

⛓️⚓⛓️  AveryOS™ Sovereign Policy Watcher | Phase 105 | 🤛🏻 Jason Lee Avery (ROOT0)
`;
  const infraFd = fs.openSync(filePath, 'w');
  try { fs.writeSync(infraFd, content); } finally { fs.closeSync(infraFd); }
  console.log(`📄 Infrastructure Update drafted: ${fileName}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⛓️⚓⛓️  AveryOS™ Daily Policy Scraper — Phase 105');
  console.log(`   Kernel: ${KERNEL_VERSION}  |  Dry-run: ${DRY_RUN}`);
  console.log(`   Monitoring ${POLICIES.length} policy URLs across 5 platforms\n`);

  const state   = loadState();
  const updated = { ...state };

  /** @type {{ policy: PolicyEntry, previousHash: string, newHash: string, snippet: string }[]} */
  const changes = [];
  /** @type {{ platform: string, category: string, url: string, error: string }[]} */
  const errors  = [];

  for (const policy of POLICIES) {
    const key = `${policy.platform}::${policy.category}::${policy.url}`;
    try {
      process.stdout.write(`  🔍 ${policy.platform} / ${policy.category} … `);
      const html    = await fetchText(policy.url);
      const text    = normalise(html);
      const newHash = sha256(text);
      const prevHash = state[key] ?? '';

      if (prevHash && prevHash !== newHash) {
        console.log(`⚠️  CHANGED`);
        changes.push({
          policy,
          previousHash: prevHash,
          newHash,
          snippet: text.slice(0, 500),
        });
      } else if (!prevHash) {
        console.log(`🆕 NEW  (${newHash.slice(0, 12)}…)`);
      } else {
        console.log(`✓  unchanged (${newHash.slice(0, 12)}…)`);
      }

      updated[key] = newHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✖  ERROR: ${msg}`);
      errors.push({ platform: policy.platform, category: policy.category, url: policy.url, error: msg });
    }
  }

  // ── Persist updated hashes ─────────────────────────────────────────────────
  if (!DRY_RUN) saveState(updated);

  console.log('\n── Summary ─────────────────────────────────────────────────────────');
  console.log(`   Changes detected: ${changes.length}`);
  console.log(`   Errors:           ${errors.length}`);

  if (changes.length === 0 && errors.length === 0) {
    logAosHeal('POLICY_SCAN', 'All policy hashes stable — no drift detected.');
    console.log('\n✅ No policy changes detected. Kernel alignment maintained.\n');
    return;
  }

  // ── Process changes ────────────────────────────────────────────────────────
  for (const change of changes) {
    console.log(`\n🚨 CHANGE: ${change.policy.platform} / ${change.policy.category}`);
    console.log(`   URL:  ${change.policy.url}`);
    console.log(`   Prev: ${change.previousHash.slice(0, 16)}…`);
    console.log(`   New:  ${change.newHash.slice(0, 16)}…`);

    draftInfrastructureUpdate(
      change.policy,
      change.previousHash,
      change.newHash,
      change.snippet,
    );

    const alertTitle   = `🛡️ Policy Change: ${change.policy.platform} ${change.policy.category}`;
    const alertMessage = `⚠️ ${change.policy.platform} updated its ${change.policy.category} policy.\n` +
      `Hash: ${change.previousHash.slice(0, 8)}… → ${change.newHash.slice(0, 8)}…\n` +
      `URL: ${change.policy.url}\n` +
      `Review for sovereignty impact. Infrastructure Update drafted.\n` +
      `⛓️⚓⛓️ Kernel ${KERNEL_VERSION}`;

    await sendPushoverAlert(alertTitle, alertMessage, 1);
  }

  if (errors.length > 0) {
    const errSummary = errors.map(e => `${e.platform}/${e.category}: ${e.error}`).join('; ');
    logAosError(AOS_ERROR.EXTERNAL_API_ERROR, `Policy fetch errors: ${errSummary}`);
  }

  console.log(`\n⛓️⚓⛓️  Policy scan complete. ${changes.length} change(s) detected. 🤛🏻\n`);
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, 'Policy watcher crashed', err);
  process.exit(1);
});
