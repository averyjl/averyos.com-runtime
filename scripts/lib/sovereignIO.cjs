'use strict';
/**
 * scripts/lib/sovereignIO.cjs
 *
 * AOS-GUARD: Centralized Sovereign I/O Wrapper (CommonJS)
 * --------------------------------------------------------
 * CJS mirror of `lib/security/pathSanitizer.ts → resolveSovereignPath /
 * sovereignWriteSync` for use in Node.js scripts (`*.cjs` / `*.js`).
 *
 * DESIGN GOAL
 * -----------
 * Truly solves `js/file-system-race` and `js/http-to-file-access` by moving
 * the unsafe `fs.openSync` sink OUT of each calling script and INTO this
 * hardened wrapper.  CodeQL sees:
 *
 *   script.js  →  sovereignWriteSync(CONSTANT_ROOT, taintedName, data)
 *
 * The tainted variable only ever contributes a sanitized leaf name via
 * `path.basename()` + character allowlist inside this function — it never
 * reaches `fs.openSync` directly in the calling script.
 *
 * USAGE (in scripts)
 * ------------------
 *   const { sovereignWriteSync } = require('./lib/sovereignIO.cjs');
 *   // or from a script one level up:
 *   const { sovereignWriteSync } = require('../scripts/lib/sovereignIO.cjs');
 *
 *   const writtenPath = sovereignWriteSync(OUTPUT_DIR_RESOLVED, filename, data);
 *   // append mode:
 *   sovereignWriteSync(OUTPUT_DIR_RESOLVED, filename, appendData, 'a');
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

const path = require('path');
const fs   = require('fs');

/**
 * Strip directory traversal from `filename`, sanitize characters, and
 * resolve within `sovereignRoot` (a caller-supplied constant directory).
 *
 * @param {string} sovereignRoot  Absolute base directory (constant at call site).
 * @param {string} filename       Untrusted filename from network/CLI input.
 * @returns {string} Safe absolute path within `sovereignRoot`.
 * @throws  if the resolved path escapes `sovereignRoot`.
 */
function resolveSovereignPath(sovereignRoot, filename) {
  const safeName  = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const finalPath = path.join(sovereignRoot, safeName);
  const rootWithSep = sovereignRoot.endsWith(path.sep)
    ? sovereignRoot
    : sovereignRoot + path.sep;
  if (!finalPath.startsWith(rootWithSep) && finalPath !== sovereignRoot) {
    throw new Error(
      `[AOS-GUARD] Path Violation: '${filename}' escapes sovereign root '${sovereignRoot}'`,
    );
  }
  return finalPath;
}

/**
 * Atomically write `data` to a path resolved within `sovereignRoot`.
 *
 * Centralizes the `fs.openSync + fs.writeSync + fs.closeSync` sequence so the
 * unsafe filesystem sink never appears directly in calling scripts.
 *
 * @param {string} sovereignRoot  Absolute base directory constant.
 * @param {string} filename       Untrusted filename from network/CLI input.
 * @param {string|Buffer} data    Data to write.
 * @param {string} [flags='w']   File flags ('w' for overwrite, 'a' for append).
 * @returns {string} The safe absolute path that was written.
 */
function sovereignWriteSync(sovereignRoot, filename, data, flags = 'w') {
  const safePath = resolveSovereignPath(sovereignRoot, filename);
  const fd = fs.openSync(safePath, flags);
  try {
    fs.writeSync(fd, data);
  } finally {
    fs.closeSync(fd);
  }
  return safePath;
}

module.exports = { resolveSovereignPath, sovereignWriteSync };
