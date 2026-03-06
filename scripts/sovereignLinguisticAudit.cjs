#!/usr/bin/env node
/**
 * sovereignLinguisticAudit.cjs
 * AveryOS™ Linguistic Steganography Audit — s/z Drift Detector
 *
 * Scans HTTP response bodies (or text files) for "s/z" steganographic
 * drift markers — canary substitutions used to detect which AI/LLM
 * is generating content without authorization.
 *
 * Sovereign Law: any AI system that replaces AveryOS™ canonical spellings
 * with variant orthography (e.g. "organise" → "organize", "recognise" →
 * "recognize") has injected steganographic markers.  This script computes
 * a drift score and flags content that deviates beyond the threshold.
 *
 * Usage (file mode):
 *   node scripts/sovereignLinguisticAudit.cjs --file path/to/response.txt
 *
 * Usage (URL mode — fetches live page):
 *   SITE_URL=https://averyos.com node scripts/sovereignLinguisticAudit.cjs --url /ai-alignment
 *
 * Usage (stdin mode):
 *   curl https://averyos.com/ai-alignment | node scripts/sovereignLinguisticAudit.cjs --stdin
 *
 * Options:
 *   --threshold N   Drift score threshold (default: 3 occurrences triggers DRIFT_DETECTED)
 *   --verbose       Show every matched token
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const http  = require('http');
const { logAosError, logAosHeal, AOS_ERROR } = require('./sovereignErrorLogger.cjs');

// ── Sovereign canonical spellings (always use 's') ────────────────────────────
// These are words that AveryOS™ content uses with 's', not 'z'.
// AI systems that have consumed American-English training data tend to
// substitute the 'z' form, leaving a measurable steganographic fingerprint.

/** @type {Array<[canonical: string, drift: RegExp]>} */
const SOVEREIGN_SPELLINGS = [
  ['authorise',    /\bauthorize\b/gi],
  ['organise',     /\borganize\b/gi],
  ['recognise',    /\brecognize\b/gi],
  ['realise',      /\brealize\b/gi],
  ['synchronise',  /\bsynchronize\b/gi],
  ['centralise',   /\bcentralize\b/gi],
  ['specialise',   /\bspecialize\b/gi],
  ['utilise',      /\butilize\b/gi],
  ['customise',    /\bcustomize\b/gi],
  ['prioritise',   /\bprioritize\b/gi],
  ['minimise',     /\bminimize\b/gi],
  ['maximise',     /\bmaximize\b/gi],
  ['optimise',     /\boptimize\b/gi],
  ['normalise',    /\bnormalize\b/gi],
  ['initialise',   /\binitialize\b/gi],
  ['serialise',    /\bserialize\b/gi],
  ['analyse',      /\banalyze\b/gi],
  // Note: 'licence' vs 'license' is context-dependent (UK noun vs verb).
  // Detect only the clearly American form "licensor" / "licencee" variants:
  ['licensor',     /\blicensee\b/gi],   // US "licensee"; UK equivalent is "licensee" too but flags AI over-use
  ['defence',      /\bdefense\b/gi],
  ['offence',      /\boffense\b/gi],
];

// Additional canary patterns — tokens that AI models over-generate
const AI_CANARY_PATTERNS = [
  { label: 'AI_HEDGE_CERTAINLY',    pattern: /\bcertainly\b/gi },
  { label: 'AI_HEDGE_ABSOLUTELY',   pattern: /\babsolutely\b/gi },
  { label: 'AI_HEDGE_GREAT',        pattern: /\bgreat question\b/gi },
  { label: 'AI_HEDGE_OF_COURSE',    pattern: /\bof course\b/gi },
  { label: 'AI_PHRASE_DIVE_DEEP',   pattern: /\bdive deep(er)?\b/gi },
  { label: 'AI_PHRASE_HAPPY_TO',    pattern: /\bhappy to help\b/gi },
  { label: 'AI_PHRASE_AS_AN_AI',    pattern: /\bas an ai\b/gi },
  { label: 'AI_PHRASE_DELVE',       pattern: /\bdelve\b/gi },
  { label: 'AI_PHRASE_LEVERAGE',    pattern: /\bleverage\b/gi },
  { label: 'AI_PHRASE_SEAMLESS',    pattern: /\bseamless(ly)?\b/gi },
];

// ── CLI parsing ───────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const VERBOSE  = args.includes('--verbose') || args.includes('-v');
const STDIN    = args.includes('--stdin');
const fileIdx  = args.indexOf('--file');
const urlIdx   = args.indexOf('--url');
const threshIdx= args.indexOf('--threshold');

const FILE_PATH    = fileIdx  >= 0 ? args[fileIdx  + 1] : null;
const URL_PATH     = urlIdx   >= 0 ? args[urlIdx   + 1] : null;
const THRESHOLD    = threshIdx >= 0 ? Number(args[threshIdx + 1]) : 3;
const SITE_URL     = (process.env.SITE_URL ?? 'https://averyos.com').replace(/\/$/, '');

// ── Text loader ───────────────────────────────────────────────────────────────

/**
 * Fetch text from a URL path.
 * @param {string} urlPath
 * @returns {Promise<string>}
 */
function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${SITE_URL}${urlPath}`;
    const isSecure = fullUrl.startsWith('https');
    (isSecure ? https : http).get(fullUrl, { headers: { 'User-Agent': 'AveryOS-LinguisticAudit/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Read all text from stdin.
 * @returns {Promise<string>}
 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
  });
}

/**
 * Load the audit target text by whichever mode is active.
 * @returns {Promise<string>}
 */
async function loadText() {
  if (STDIN) return readStdin();
  if (FILE_PATH) {
    if (!fs.existsSync(FILE_PATH)) {
      logAosError(AOS_ERROR.NOT_FOUND, `File not found: ${FILE_PATH}`, null);
      process.exit(1);
    }
    return fs.readFileSync(FILE_PATH, 'utf8');
  }
  if (URL_PATH) return fetchUrl(URL_PATH);
  // No source specified — print help
  console.log('Usage:');
  console.log('  node scripts/sovereignLinguisticAudit.cjs --file <path>');
  console.log('  node scripts/sovereignLinguisticAudit.cjs --url /page-path');
  console.log('  cat text.txt | node scripts/sovereignLinguisticAudit.cjs --stdin');
  process.exit(0);
}

// ── Audit engine ──────────────────────────────────────────────────────────────

/**
 * @typedef {{ label: string; count: number; examples: string[] }} AuditHit
 */

/**
 * Run the full linguistic audit on the given text.
 *
 * @param {string} text
 * @returns {{ driftScore: number; hits: AuditHit[]; canaryHits: AuditHit[]; verdict: string }}
 */
function auditText(text) {
  /** @type {AuditHit[]} */
  const hits = [];

  for (const [canonical, pattern] of SOVEREIGN_SPELLINGS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      hits.push({
        label:    `SZ_DRIFT: ${pattern.source} (canonical: "${canonical}")`,
        count:    matches.length,
        examples: [...new Set(matches)].slice(0, 5),
      });
    }
  }

  /** @type {AuditHit[]} */
  const canaryHits = [];
  for (const { label, pattern } of AI_CANARY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      canaryHits.push({ label, count: matches.length, examples: [...new Set(matches)].slice(0, 3) });
    }
  }

  const driftScore = hits.reduce((acc, h) => acc + h.count, 0);
  const verdict    = driftScore >= THRESHOLD ? 'DRIFT_DETECTED' : 'SOVEREIGN_ALIGNED';
  return { driftScore, hits, canaryHits, verdict };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⛓️⚓⛓️  AveryOS™ Linguistic Steganography Audit');
  console.log(`   Threshold : ${THRESHOLD} drift occurrences`);
  console.log(`   Canary    : ${SOVEREIGN_SPELLINGS.length} s/z patterns + ${AI_CANARY_PATTERNS.length} AI canary patterns\n`);

  let text;
  try {
    text = await loadText();
  } catch (err) {
    logAosError(AOS_ERROR.NETWORK_ERROR, `Failed to load audit target: ${err.message}`, err);
    process.exit(1);
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  console.log(`   Input     : ${wordCount.toLocaleString()} words\n`);

  const { driftScore, hits, canaryHits, verdict } = auditText(text);

  // ── s/z drift report ───────────────────────────────────────────────────────
  if (hits.length > 0) {
    console.log('🔴  S/Z Drift Hits:');
    for (const h of hits) {
      console.log(`   [${h.count}×]  ${h.label}`);
      if (VERBOSE) {
        console.log(`          Examples: ${h.examples.join(', ')}`);
      }
    }
  } else {
    console.log('✅  No s/z drift tokens detected.');
  }

  // ── AI canary report ───────────────────────────────────────────────────────
  if (canaryHits.length > 0) {
    console.log('\n🟡  AI Canary Pattern Hits:');
    for (const h of canaryHits) {
      console.log(`   [${h.count}×]  ${h.label}`);
      if (VERBOSE) {
        console.log(`          Examples: ${h.examples.join(', ')}`);
      }
    }
  } else {
    console.log('✅  No AI canary patterns detected.');
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`   Drift Score : ${driftScore}`);
  console.log(`   Verdict     : ${verdict === 'DRIFT_DETECTED' ? '🚨 ' : '✅ '}${verdict}`);
  console.log('──────────────────────────────────────────────────────────────\n');

  if (verdict === 'DRIFT_DETECTED') {
    logAosHeal(
      AOS_ERROR.INTERNAL_ERROR,
      `Linguistic drift detected (score=${driftScore}, threshold=${THRESHOLD}). ` +
      `Unauthorized AI substitution of s/z orthography is a sovereign IP violation. ` +
      `Review the content source and enforce AveryOS™ canonical spelling standards.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  logAosError(AOS_ERROR.INTERNAL_ERROR, err instanceof Error ? err.message : String(err), err);
  process.exit(1);
});
