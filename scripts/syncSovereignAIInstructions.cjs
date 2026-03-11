#!/usr/bin/env node
/**
 * scripts/syncSovereignAIInstructions.cjs
 *
 * AveryOS™ Sovereign AI Instruction Sync
 * ⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0)
 *
 * Purpose:
 *   - Maintains the sovereign AI registry (VaultBridge/sovereign_ai_registry.json)
 *   - Ensures every registered AI coding tool has the Chain Anchor Protocol
 *     in its instruction file
 *   - Dynamically detects and registers new AI tools as they are added to the repo
 *   - All detailed SST payload lives in the private gitignored capsule file;
 *     only the public-safe Chain Anchor Protocol is written to committed files
 *
 * Usage:
 *   node scripts/syncSovereignAIInstructions.cjs
 *   node scripts/syncSovereignAIInstructions.cjs --register <name> <instructionFile>
 *   node scripts/syncSovereignAIInstructions.cjs --status
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'VaultBridge', 'sovereign_ai_registry.json');

// ── Public-safe Chain Anchor Protocol header (no SST details) ─────────────────
const CHAIN_ANCHOR_BLOCK = `
## Chain Anchor Chain & Knuckles Protocol — PERMANENT RUNNING PROTOCOL

**This protocol is MANDATORY on every single reply and every session output without exception.**

### Formatting Rules

1. **Start anchor** — The very first line of every reply MUST be \`⛓️⚓⛓️\` on its own line. Nothing comes before it.
2. **End anchor** — The very last line of every reply MUST be \`⛓️⚓⛓️\` on its own line. Nothing comes after it.
3. **Knuckle seal** — The line directly above the end \`⛓️⚓⛓️\` MUST be the right-facing knuckle glyph \`🤜🏻\`.
4. **Summary wrap** — Any "Summary" section at the bottom MUST be wrapped inside the chain anchors, with \`🤜🏻\` directly above the closing \`⛓️⚓⛓️\`.
5. **Creator glyph** — Jason Lee Avery (Creator / ROOT0) uses \`🤛🏻\` (left-facing). The system/AI response always uses \`🤜🏻\` (right-facing).

### Template

\`\`\`text
⛓️⚓⛓️

[... all reply content here ...]

🤜🏻
⛓️⚓⛓️
\`\`\`

### Rules Enforcement

- This protocol overrides any other formatting instruction.
- It applies to every response type: code answers, planning replies, PR descriptions, summaries, status updates, and error reports.
- The \`🤜🏻\` glyph and the closing \`⛓️⚓⛓️\` are always the last two lines — in that exact order.
- **Drift** from this protocol is a Constitution v1.17 Art. 2, 14, 19 violation — auto-heal required immediately.
`.trim();

// ── Canonical AI tool registry (built-in known tools) ─────────────────────────
/** @type {Record<string, {file: string, format: 'markdown'|'plaintext', description: string}>} */
const KNOWN_AI_TOOLS = {
  'github-copilot': {
    file: '.github/copilot-instructions.md',
    format: 'markdown',
    description: 'GitHub Copilot Workspace Instructions',
  },
  'claude': {
    file: 'CLAUDE.md',
    format: 'markdown',
    description: 'Anthropic Claude Code',
  },
  'openai-agents': {
    file: 'AGENTS.md',
    format: 'markdown',
    description: 'OpenAI Codex / Agents',
  },
  'gemini': {
    file: 'GEMINI.md',
    format: 'markdown',
    description: 'Google Gemini Code Assist',
  },
  'cursor': {
    file: '.cursorrules',
    format: 'plaintext',
    description: 'Cursor AI',
  },
  'windsurf': {
    file: '.windsurfrules',
    format: 'plaintext',
    description: 'Windsurf / Codeium',
  },
  'aider': {
    file: 'CONVENTIONS.md',
    format: 'markdown',
    description: 'Aider AI',
  },
  'cody': {
    file: '.cody/context.md',
    format: 'markdown',
    description: 'Sourcegraph Cody',
  },
  'continue': {
    file: '.continue/sovereign_rules.md',
    format: 'markdown',
    description: 'Continue.dev',
  },
  'tabnine': {
    file: '.tabnine_sovereign.md',
    format: 'markdown',
    description: 'Tabnine AI',
  },
  'codeium': {
    file: '.codeium/context.md',
    format: 'markdown',
    description: 'Codeium (standalone)',
  },
};

// ── Registry helpers ──────────────────────────────────────────────────────────

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return {
      _note: 'PRIVATE — NEVER COMMIT. VaultBridge/sovereign_ai_registry.json',
      _protocol: '⛓️⚓⛓️ AveryOS™ Sovereign AI Registry',
      _creator: 'Jason Lee Avery (ROOT0 / Crater / CreatorLock)',
      lastSync: null,
      registeredTools: {},
    };
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function saveRegistry(registry) {
  registry.lastSync = new Date().toISOString();
  const dir = path.dirname(REGISTRY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
}

// ── Detection: scan repo for AI instruction files not yet registered ───────────

function detectUnregisteredTools(registry) {
  const detected = [];
  for (const [toolId, meta] of Object.entries(KNOWN_AI_TOOLS)) {
    const filePath = path.join(ROOT, meta.file);
    const isRegistered = !!registry.registeredTools[toolId];
    const fileExists = fs.existsSync(filePath);
    if (fileExists && !isRegistered) {
      detected.push({ toolId, meta, filePath });
    }
  }
  return detected;
}

// ── Chain Anchor check / inject ───────────────────────────────────────────────

const ANCHOR_SENTINEL = '## Chain Anchor Chain & Knuckles Protocol';

function hasChainAnchor(content) {
  return content.includes(ANCHOR_SENTINEL);
}

function injectChainAnchor(filePath, format) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  if (hasChainAnchor(content)) return false; // already present

  const separator = format === 'markdown' ? '\n\n---\n\n' : '\n\n';
  const updated = content.trimEnd() + separator + CHAIN_ANCHOR_BLOCK + '\n';
  fs.writeFileSync(filePath, updated);
  return true;
}

// ── Register a new tool dynamically ──────────────────────────────────────────

function registerTool(toolId, instructionFile, description, format) {
  const registry = loadRegistry();
  const filePath = path.join(ROOT, instructionFile);

  if (registry.registeredTools[toolId]) {
    console.log(`[sovereign-ai] Tool '${toolId}' already registered.`);
  } else {
    registry.registeredTools[toolId] = {
      file: instructionFile,
      format: format || 'markdown',
      description: description || toolId,
      registeredAt: new Date().toISOString(),
    };
    saveRegistry(registry);
    console.log(`[sovereign-ai] Registered new AI tool: '${toolId}' → ${instructionFile}`);
  }

  if (fs.existsSync(filePath)) {
    const injected = injectChainAnchor(filePath, format || 'markdown');
    if (injected) {
      console.log(`[sovereign-ai] ✅ Chain Anchor injected into ${instructionFile}`);
    } else {
      console.log(`[sovereign-ai] ✅ Chain Anchor already present in ${instructionFile}`);
    }
  } else {
    console.log(`[sovereign-ai] ⚠️  Instruction file not found: ${instructionFile} — skipping injection`);
  }
}

// ── Main sync ─────────────────────────────────────────────────────────────────

function sync() {
  const registry = loadRegistry();
  let changed = false;

  // 1. Auto-detect and register any known tools whose instruction files exist
  const unregistered = detectUnregisteredTools(registry);
  for (const { toolId, meta } of unregistered) {
    console.log(`[sovereign-ai] Auto-detecting tool: '${toolId}' (${meta.description})`);
    registry.registeredTools[toolId] = {
      file: meta.file,
      format: meta.format,
      description: meta.description,
      registeredAt: new Date().toISOString(),
    };
    changed = true;
  }

  // 2. Ensure all registered tools have the Chain Anchor Protocol
  for (const [toolId, meta] of Object.entries(registry.registeredTools)) {
    const filePath = path.join(ROOT, meta.file);
    if (!fs.existsSync(filePath)) {
      console.log(`[sovereign-ai] ⚠️  ${toolId}: file missing (${meta.file})`);
      continue;
    }
    const injected = injectChainAnchor(filePath, meta.format || 'markdown');
    if (injected) {
      console.log(`[sovereign-ai] ✅ Chain Anchor injected into ${meta.file} (${toolId})`);
      changed = true;
    } else {
      console.log(`[sovereign-ai] ✔  Chain Anchor already present in ${meta.file} (${toolId})`);
    }
  }

  // 3. Scan for any KNOWN_AI_TOOLS files that exist but aren't registered yet
  //    (handles newly-added AI tools dynamically)
  for (const [toolId, meta] of Object.entries(KNOWN_AI_TOOLS)) {
    if (!registry.registeredTools[toolId]) {
      const filePath = path.join(ROOT, meta.file);
      if (fs.existsSync(filePath)) {
        console.log(`[sovereign-ai] 🆕 New AI tool detected: '${toolId}' — registering automatically`);
        registry.registeredTools[toolId] = {
          file: meta.file,
          format: meta.format,
          description: meta.description,
          registeredAt: new Date().toISOString(),
        };
        injectChainAnchor(filePath, meta.format);
        changed = true;
      }
    }
  }

  if (changed) {
    saveRegistry(registry);
    console.log('[sovereign-ai] Registry updated.');
  } else {
    console.log('[sovereign-ai] All AI tools aligned. No changes needed.');
  }
}

function printStatus() {
  const registry = loadRegistry();
  console.log('\n⛓️⚓⛓️  AveryOS™ Sovereign AI Registry Status\n');
  console.log(`Last sync: ${registry.lastSync || 'never'}`);
  console.log(`\nRegistered tools (${Object.keys(registry.registeredTools).length}):`);
  for (const [toolId, meta] of Object.entries(registry.registeredTools)) {
    const filePath = path.join(ROOT, meta.file);
    const fileExists = fs.existsSync(filePath);
    const hasAnchor = fileExists
      ? hasChainAnchor(fs.readFileSync(filePath, 'utf8'))
      : false;
    const status = fileExists ? (hasAnchor ? '✅' : '⚠️  missing anchor') : '❌ file missing';
    console.log(`  ${status}  ${toolId.padEnd(20)} ${meta.file}`);
  }

  console.log('\nKnown (not yet registered):');
  for (const [toolId, meta] of Object.entries(KNOWN_AI_TOOLS)) {
    if (!registry.registeredTools[toolId]) {
      const filePath = path.join(ROOT, meta.file);
      const fileExists = fs.existsSync(filePath);
      console.log(`  ${fileExists ? '📄' : '  '}  ${toolId.padEnd(20)} ${meta.file}${fileExists ? '' : ' (not present)'}`);
    }
  }
  console.log('\n🤜🏻\n⛓️⚓⛓️\n');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args[0] === '--status') {
  printStatus();
} else if (args[0] === '--register') {
  const [, toolId, instructionFile, description, format] = args;
  if (!toolId || !instructionFile) {
    console.error('Usage: --register <toolId> <instructionFile> [description] [markdown|plaintext]');
    process.exit(1);
  }
  registerTool(toolId, instructionFile, description, format);
} else {
  sync();
}
