#!/usr/bin/env node
/**
 * scripts/generate-docs.cjs
 *
 * AveryOS™ Sovereign Documentation Generator — Phase 108.3
 *
 * Scans lib/ and app/api/ for exported TypeScript symbols and their JSDoc
 * comments. Emits an IP-safe Markdown index plus a JSON manifest to
 * public/admin/docs/.
 *
 * IP Safety Rules (Secret-Scanner):
 *   • Never emits KERNEL_SHA values (they are stripped from function bodies
 *     before inclusion in output).
 *   • Never emits private key patterns (-----BEGIN, API keys, etc.).
 *   • Never emits hex strings >= 64 chars (SHA-512 fingerprint exposure).
 *   • Never emits strings matching *.aoskey, *.aosvault patterns.
 *
 * Run:
 *   node scripts/generate-docs.cjs
 *
 * Output:
 *   public/admin/docs/index.md    — Human-readable sovereign docs
 *   public/admin/docs/index.json  — Machine-readable manifest for the docs UI
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT      = process.cwd();
const OUT_DIR   = path.join(ROOT, "public", "admin", "docs");
const OUT_MD    = path.join(OUT_DIR, "index.md");
const OUT_JSON  = path.join(OUT_DIR, "index.json");

/** Directories to scan for exported symbols (relative to project root). */
const SCAN_DIRS = [
  path.join(ROOT, "lib"),
  path.join(ROOT, "app", "api"),
];

/** File extensions to process. */
const EXTENSIONS = new Set([".ts", ".tsx"]);

/** IP-safety patterns — any line matching these is redacted. */
const REDACT_PATTERNS = [
  /[0-9a-f]{64,}/i,              // SHA-512 / long hex strings
  /-----BEGIN/,                  // Private key headers
  /STRIPE_SECRET_KEY/i,          // Stripe secrets
  /FIREBASE_PRIVATE_KEY/i,       // Firebase private key
  /VAULT_PASSPHRASE/i,           // Vault passphrase
  /\.aoskey|\.aosvault/i,        // Sovereign key file references
  /api_key\s*[:=]/i,             // Generic API key assignments
];

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Walk a directory recursively, yielding absolute file paths.
 */
function* walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, dist, .open-next
      if (["node_modules", ".next", "dist", ".open-next"].includes(entry.name)) continue;
      yield* walkDir(full);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

/**
 * Strip any line that matches an IP-safety redaction pattern.
 */
function redact(text) {
  return text
    .split("\n")
    .map((line) => REDACT_PATTERNS.some((re) => re.test(line)) ? "[REDACTED]" : line)
    .join("\n");
}

/**
 * Extract the leading JSDoc comment block above a given line index.
 */
function extractJsdoc(lines, lineIndex) {
  const result = [];
  let i = lineIndex - 1;
  // Skip blank lines above the export
  while (i >= 0 && lines[i].trim() === "") i--;
  // Collect backwards until we reach a line that isn't part of a comment block
  const commentLines = [];
  while (i >= 0) {
    const l = lines[i].trim();
    if (l.startsWith("*") || l.startsWith("/**") || l.startsWith("*/") || l === "*/") {
      commentLines.unshift(lines[i]);
      i--;
    } else if (l.startsWith("//")) {
      commentLines.unshift(lines[i]);
      i--;
    } else {
      break;
    }
  }
  // Clean up comment markers
  for (const cl of commentLines) {
    const clean = cl.replace(/^\s*\*\s?/, "").replace(/^\s*\/\*\*?\s?/, "").replace(/\*\/\s*$/, "").trim();
    if (clean) result.push(clean);
  }
  return result.join(" ").trim();
}

/**
 * Parse a single TypeScript file and extract exported symbols + doc strings.
 */
function parseFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const lines   = content.split("\n");
  const symbols = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: export function / export const / export interface / export type / export class / export async function
    const exportMatch = line.match(
      /^export\s+(async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
    );
    if (!exportMatch) continue;

    const kind = line.match(/(?:function|const|class|interface|type|enum)\s/)?.[0]?.trim() ?? "export";
    const name = exportMatch[2];
    const doc  = extractJsdoc(lines, i);

    // Redact any sensitive content from doc strings
    const safeDoc = redact(doc);

    symbols.push({ name, kind, doc: safeDoc, file: rel });
  }

  return symbols;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allSymbols = [];

  for (const dir of SCAN_DIRS) {
    for (const filePath of walkDir(dir)) {
      const syms = parseFile(filePath);
      allSymbols.push(...syms);
    }
  }

  const generatedAt = new Date().toISOString();
  const symbolCount = allSymbols.length;

  // ── Write JSON manifest ───────────────────────────────────────────────────
  const manifest = {
    generated_at:  generatedAt,
    symbol_count:  symbolCount,
    kernel_version: "v3.6.2",
    symbols:       allSymbols,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2), "utf8");

  // ── Write Markdown docs ───────────────────────────────────────────────────
  const byFile = {};
  for (const sym of allSymbols) {
    if (!byFile[sym.file]) byFile[sym.file] = [];
    byFile[sym.file].push(sym);
  }

  const lines = [
    "# AveryOS™ Sovereign API Documentation",
    "",
    `> Generated: ${generatedAt}  `,
    `> Symbols: ${symbolCount}  `,
    `> Kernel: v3.6.2  `,
    `> ⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻`,
    "",
    "---",
    "",
  ];

  for (const [file, syms] of Object.entries(byFile)) {
    lines.push(`## \`${file}\``);
    lines.push("");
    for (const sym of syms) {
      lines.push(`### \`${sym.name}\` *(${sym.kind})*`);
      if (sym.doc) lines.push(`> ${sym.doc}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(OUT_MD, lines.join("\n"), "utf8");

  console.log(`[generate-docs] ✅ ${symbolCount} symbols → ${OUT_DIR}`);
  console.log(`[generate-docs]   index.md:   ${OUT_MD}`);
  console.log(`[generate-docs]   index.json: ${OUT_JSON}`);
}

main();
