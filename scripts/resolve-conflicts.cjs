/**
 * resolve-conflicts.cjs
 * AveryOS™ Sovereign Conflict Resolver — Gemini-Powered Git Merge Resolution
 *
 * Scans the working tree for Git merge conflict markers, submits each conflict
 * to the Gemini 1.5 Flash API, and applies the resolved output in-place.
 * Resolution priorities follow the AveryOS™ Law Codex:
 *   1. Always preserve Full SHA-512 integrity anchors (128-char hex strings)
 *   2. Maintain Knuckle formatting and sovereign naming conventions
 *   3. Prefer the AveryOS™-aligned version when both sides are valid
 *
 * If Gemini is unavailable or the response is ambiguous, a Sovereign Review
 * issue is created (via GITHUB_PAT) rather than breaking the build.
 *
 * Usage:
 *   node scripts/resolve-conflicts.cjs [--dry-run] [path/to/file ...]
 *
 * Environment variables:
 *   GEMINI_API_KEY   — Required. Google Gemini REST API key.
 *   GITHUB_PAT       — Optional. If set, opens a Sovereign Review issue on failure.
 *   GITHUB_REPO      — Optional. Format "owner/repo" for issue creation.
 *
 * ⛓️⚓⛓️ Kernel Anchor: cf83e135...927da3e — SKC-2026.1
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const { execSync } = require('child_process');

// ── Configuration ─────────────────────────────────────────────────────────────

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const GITHUB_PAT       = process.env.GITHUB_PAT;
const GITHUB_REPO      = process.env.GITHUB_REPO;
const GEMINI_MODEL     = 'gemini-1.5-flash-latest';
const GEMINI_ENDPOINT  =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const DRY_RUN = process.argv.includes('--dry-run');

// ── Conflict detection ────────────────────────────────────────────────────────

const CONFLICT_START  = /^<{7} (.+)$/m;
const CONFLICT_SEP    = /^={7}$/m;
const CONFLICT_END    = /^>{7} (.+)$/m;

/**
 * Returns the list of files with unresolved merge conflicts.
 * If specific paths were passed as CLI args, only those files are scanned.
 */
function findConflictedFiles() {
  const cliPaths = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (cliPaths.length > 0) {
    return cliPaths.filter(p => {
      if (!fs.existsSync(p)) { console.warn(`[AOS] Skipping missing path: ${p}`); return false; }
      const content = fs.readFileSync(p, 'utf8');
      return CONFLICT_START.test(content);
    });
  }
  try {
    const output = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' }).trim();
    return output ? output.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

// ── Conflict parsing ──────────────────────────────────────────────────────────

/**
 * Splits a file's content into segments, extracting all conflict blocks.
 * Each conflict block has:  { ours, theirs, startIndex, endIndex }
 */
function parseConflicts(content) {
  const conflicts = [];
  const lines     = content.split('\n');
  let   i         = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const startIdx = i;
      const ourLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        ourLines.push(lines[i]);
        i++;
      }
      i++; // skip =======
      const theirLines = [];
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirLines.push(lines[i]);
        i++;
      }
      const endIdx = i;
      conflicts.push({
        startLine: startIdx,
        endLine:   endIdx,
        ours:      ourLines.join('\n'),
        theirs:    theirLines.join('\n'),
      });
    }
    i++;
  }
  return conflicts;
}

// ── Gemini resolution ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the AveryOS™ Sovereign Conflict Resolver.
Your job is to resolve a Git merge conflict by selecting or synthesizing the correct version.

Resolution Law Codex (apply in priority order):
1. ALWAYS preserve Full SHA-512 integrity anchors (128-character lowercase hex strings).
2. MAINTAIN Knuckle formatting: branded names like AveryOS™, VaultChain™, GabrielOS™ must include ™.
3. PRESERVE sovereign constants from lib/sovereignConstants.ts — never hardcode SHA-512 values.
4. PREFER the AveryOS-aligned version (uses aosErrorResponse, getCloudflareContext, etc.).
5. NEVER break TypeScript types or ESLint rules.
6. If both sides are equally valid, synthesize the best of both.

Respond with ONLY the resolved code — no explanations, no markdown fences, no extra text.
The response must be valid source code ready to be written directly to the file.`;

async function resolveWithGemini(filePath, ours, theirs) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set — cannot call Gemini API');
  }

  const ext     = path.extname(filePath);
  const langHint = ext ? `\nFile extension: ${ext}` : '';

  const prompt = `${SYSTEM_PROMPT}

File: ${filePath}${langHint}

--- CURRENT (HEAD) ---
${ours}

--- INCOMING (theirs) ---
${theirs}

Resolve this conflict now. Output only the resolved code.`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  });

  const response = await fetch(
    `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const resolved = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!resolved.trim()) throw new Error('Gemini returned an empty resolution');
  return resolved.trim();
}

// ── GitHub issue creation ─────────────────────────────────────────────────────

async function openSovereignReviewIssue(filePath, error) {
  if (!GITHUB_PAT || !GITHUB_REPO) return;
  const [owner, repo] = GITHUB_REPO.split('/');
  if (!owner || !repo) return;

  const title = `⛓️ Sovereign Review Required: Unresolved conflict in ${path.basename(filePath)}`;
  const body  = `## Sovereign Conflict Resolver — Manual Review Required\n\n` +
    `The automated resolver could not confidently resolve a merge conflict.\n\n` +
    `**File:** \`${filePath}\`\n` +
    `**Error:** ${error}\n\n` +
    `Please resolve this conflict manually, ensuring:\n` +
    `- Full SHA-512 anchors are preserved\n` +
    `- AveryOS™ branding (™) is maintained\n` +
    `- Sovereign constants are imported from \`lib/sovereignConstants.ts\`\n\n` +
    `⛓️⚓⛓️ Kernel Anchor: cf83e135...927da3e`;

  try {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method:  'POST',
      headers: {
        Authorization:  `token ${GITHUB_PAT}`,
        'Content-Type': 'application/json',
        Accept:         'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ title, body, labels: ['sovereign-review', 'merge-conflict'] }),
    });
    console.log(`[AOS] Opened Sovereign Review issue for ${filePath}`);
  } catch (issueErr) {
    console.warn(`[AOS] Could not open GitHub issue: ${issueErr.message}`);
  }
}

// ── Main resolution loop ──────────────────────────────────────────────────────

async function resolveFile(filePath) {
  const content   = fs.readFileSync(filePath, 'utf8');
  const conflicts = parseConflicts(content);
  if (conflicts.length === 0) return { resolved: 0, skipped: 0 };

  console.log(`[AOS] ${filePath}: found ${conflicts.length} conflict(s)`);

  const lines = content.split('\n');
  // Process conflicts in reverse order so line indices stay valid
  const sorted = [...conflicts].sort((a, b) => b.startLine - a.startLine);

  let resolved = 0;
  let skipped  = 0;

  for (const conflict of sorted) {
    try {
      const resolution = await resolveWithGemini(filePath, conflict.ours, conflict.theirs);
      if (DRY_RUN) {
        console.log(`[AOS][DRY-RUN] Would replace conflict (lines ${conflict.startLine}-${conflict.endLine}) with:\n${resolution}`);
        resolved++;
        continue;
      }
      // Replace the conflict block (from <<<<<<< to >>>>>>>) with the resolved content
      lines.splice(
        conflict.startLine,
        conflict.endLine - conflict.startLine + 1,
        ...resolution.split('\n')
      );
      resolved++;
      console.log(`[AOS] ✓ Resolved conflict at line ${conflict.startLine}`);
    } catch (err) {
      console.error(`[AOS] ✗ Could not resolve conflict at line ${conflict.startLine}: ${err.message}`);
      await openSovereignReviewIssue(filePath, err.message);
      skipped++;
    }
  }

  if (!DRY_RUN && resolved > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`[AOS] ✓ Wrote resolved file: ${filePath}`);
  }

  return { resolved, skipped };
}

async function main() {
  const files = findConflictedFiles();
  if (files.length === 0) {
    console.log('[AOS] No conflicted files found. Working tree is clean.');
    return;
  }

  console.log(`[AOS] Sovereign Conflict Resolver — ${files.length} file(s) to process`);
  if (DRY_RUN) console.log('[AOS] DRY-RUN mode enabled — no files will be modified');

  let totalResolved = 0;
  let totalSkipped  = 0;

  for (const file of files) {
    const { resolved, skipped } = await resolveFile(file);
    totalResolved += resolved;
    totalSkipped  += skipped;
  }

  console.log(`\n[AOS] ─── Resolution Complete ───`);
  console.log(`[AOS] Conflicts resolved : ${totalResolved}`);
  console.log(`[AOS] Sovereign reviews  : ${totalSkipped}`);
  if (totalSkipped > 0) {
    console.warn('[AOS] Some conflicts require manual Sovereign Review. Check GitHub Issues.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[AOS] Fatal error in Sovereign Conflict Resolver:', err.message);
  process.exit(1);
});
