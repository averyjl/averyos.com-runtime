/**
 * scripts/lib/sovereignIO.cjs
 *
 * AveryOS™ Sovereign I/O — CJS Mirror
 *
 * CommonJS mirror of the TypeScript sovereign write primitives in
 * lib/security/pathSanitizer.ts.  All Node.js scripts (*.cjs / *.js) that
 * write files MUST use `sovereignWriteSync` from this module rather than
 * calling fs.writeFileSync, fs.openSync, or fs.writeSync directly with a
 * dynamically-derived path.
 *
 * Architecture:  The *root* argument is always a compile-time constant from
 * this module — this explicitly breaks CodeQL's taint flow between untrusted
 * input and the filesystem API, eliminating js/path-injection and
 * js/non-literal-fs-filename alerts without any suppression comments.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Error ─────────────────────────────────────────────────────────────────────

class PathTraversalError extends Error {
  constructor(filename, root) {
    super(
      `sovereignIO rejected path '${filename}' — resolved path escapes root '${root}'. ` +
      "Only paths that remain inside the declared sovereign root are permitted.",
    );
    this.name = "PathTraversalError";
  }
}

// ── Sovereign root constants ──────────────────────────────────────────────────

/**
 * Project root — the broadest permitted write boundary for scripts.
 * Narrower roots (e.g. OUTPUT_ROOT) should be preferred where possible.
 */
const SOVEREIGN_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Dedicated output directory for generated evidence bundles and reports.
 */
const OUTPUT_ROOT = path.resolve(SOVEREIGN_ROOT, "output");

/**
 * Logs directory — sovereign log writes must stay here.
 */
const LOGS_ROOT = path.resolve(SOVEREIGN_ROOT, "logs");

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve `filename` against `sovereignRoot`, confirming the result remains
 * inside the root.  Throws {@link PathTraversalError} on traversal attempts.
 *
 * The root is always a compile-time constant from this module — this breaks
 * CodeQL taint flow: the filesystem API never receives a value derived from
 * untrusted input.
 *
 * @param {string} filename      Relative file name / path to resolve.
 * @param {string} sovereignRoot Absolute root directory (compile-time constant).
 * @returns {string}             Safe absolute path.
 */
function resolveSovereignPath(filename, sovereignRoot) {
  const resolved = path.resolve(sovereignRoot, filename);

  const rootWithSep = sovereignRoot.endsWith(path.sep)
    ? sovereignRoot
    : sovereignRoot + path.sep;

  if (!resolved.startsWith(rootWithSep) && resolved !== sovereignRoot) {
    throw new PathTraversalError(filename, sovereignRoot);
  }

  return resolved;
}

/**
 * The sole authorised file-write sink for AveryOS™ Node.js scripts.
 *
 * @param {string}          sovereignRoot Absolute root (compile-time constant).
 * @param {string}          filename      Relative file name / path.
 * @param {string | Buffer} data          Content to write.
 * @param {string}          [encoding]    File encoding (default "utf-8").
 */
function sovereignWriteSync(sovereignRoot, filename, data, encoding = "utf-8") {
  const safePath = resolveSovereignPath(filename, sovereignRoot);

  // Ensure parent directories exist.
  fs.mkdirSync(path.dirname(safePath), { recursive: true });

  fs.writeFileSync(safePath, data, encoding);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  PathTraversalError,
  SOVEREIGN_ROOT,
  OUTPUT_ROOT,
  LOGS_ROOT,
  resolveSovereignPath,
  sovereignWriteSync,
};
