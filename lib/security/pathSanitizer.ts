/**
 * lib/security/pathSanitizer.ts
 *
 * AveryOS™ Secure Path Sanitizer — Permanent Design-Stage Security Utility
 *
 * PURPOSE
 * -------
 * Any route, script, or library that builds a filesystem path from user-supplied
 * or dynamic input MUST use this module rather than passing the raw value
 * directly to fs.readFileSync / fs.writeFileSync / path.resolve etc.
 *
 * Passing untrusted strings directly to filesystem APIs is a Path Traversal
 * vulnerability (CWE-22, CodeQL js/path-injection).  Additionally, constructing
 * path arguments via string concatenation or template literals triggers the
 * CodeQL `js/non-literal-fs-filename` alert.
 *
 * DESIGN RULE (enforced here, checked by CodeQL in CI)
 * -----------------------------------------------------
 * 1. Never pass user input directly to a filesystem API.
 * 2. Always resolve the final path through `resolveSafePath()` which:
 *    a. Validates the user-supplied segment against an allowlist or pattern.
 *    b. Resolves the final absolute path using a compile-time root constant.
 *    c. Confirms the resolved path starts with the expected root — rejecting
 *       any `../../` traversal attempts.
 * 3. The resolved value returned is always sourced from deterministic root
 *    constants, never from raw user input — this breaks CodeQL's taint flow.
 *
 * USAGE
 * -----
 *   import { resolveSafePath, SAFE_CAPSULE_ROOT } from "../../lib/security/pathSanitizer";
 *
 *   // Throws PathTraversalError if capsuleId contains traversal sequences.
 *   const filePath = resolveSafePath(capsuleId, SAFE_CAPSULE_ROOT);
 *   const raw = fs.readFileSync(filePath, "utf-8");
 *
 * EXTENDING
 * ---------
 * Export additional root constants for each directory boundary that needs
 * protection, then pass the appropriate root to `resolveSafePath()`.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import fs from "fs";
import path from "path";

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Thrown when a user-supplied path segment fails sanitization.
 * Callers should return 400 (client error) when caught on an API route.
 */
export class PathTraversalError extends Error {
  constructor(segment: string, root: string) {
    super(
      `Path sanitizer rejected segment '${segment}' — resolved path escapes root '${root}'. ` +
      `Only paths that remain inside the declared root are permitted.`,
    );
    this.name = "PathTraversalError";
  }
}

// ── Safe root constants ───────────────────────────────────────────────────────

/**
 * Absolute path to the compiled capsule manifest directory.
 * All capsule reads must be confined to this directory tree.
 */
export const SAFE_CAPSULE_ROOT: string = path.resolve(
  process.cwd(),
  "public",
  "manifest",
  "capsules",
);

/**
 * Absolute path to the content directory.
 * All static Markdown / MDX reads must be confined to this directory tree.
 */
export const SAFE_CONTENT_ROOT: string = path.resolve(
  process.cwd(),
  "content",
);

/**
 * Absolute path to the logs directory.
 * All sovereign log writes must be confined to this directory tree.
 */
export const SAFE_LOGS_ROOT: string = path.resolve(
  process.cwd(),
  "logs",
);

// ── Allowed segment pattern ───────────────────────────────────────────────────

/**
 * Default regex for a single path segment supplied by untrusted input.
 *
 * Allows: alphanumerics, hyphens, underscores, and dots (but not `..`).
 * Blocks: slashes, backslashes, null bytes, or any traversal sequence.
 */
const SAFE_SEGMENT_RE = /^(?!\.\.)[a-zA-Z0-9._-]+$/;

// ── Core sanitizer ────────────────────────────────────────────────────────────

/**
 * Validate a user-supplied path segment and return a fully-resolved absolute
 * path that is guaranteed to remain inside `allowedRoot`.
 *
 * This function explicitly breaks the data-flow taint between the untrusted
 * segment value and the final path string:
 * - The *root* portion always comes from a compile-time constant.
 * - The *segment* is validated before being joined.
 * - The *resolved* path is verified to start with the root.
 *
 * @param segment     The untrusted filename or path segment from user input.
 * @param allowedRoot Absolute root directory; use one of the exported constants
 *                    (e.g. {@link SAFE_CAPSULE_ROOT}).
 * @param segmentRe   Optional override for the segment allowlist regex.
 * @returns           A safe, absolute filesystem path.
 * @throws            {@link PathTraversalError} if the segment is invalid or
 *                    if the resolved path escapes `allowedRoot`.
 */
export function resolveSafePath(
  segment: string,
  allowedRoot: string,
  segmentRe: RegExp = SAFE_SEGMENT_RE,
): string {
  // 1. Validate the segment against the allowlist pattern.
  if (!segmentRe.test(segment)) {
    throw new PathTraversalError(segment, allowedRoot);
  }

  // 2. Resolve the absolute path.  `path.resolve` is deterministic and does
  //    not invoke the filesystem — safe to call with user-derived input here
  //    because the root (first argument) is a compile-time constant and the
  //    segment has already been validated above.
  const resolved = path.resolve(allowedRoot, segment);

  // 3. Confirm the resolved path starts with the declared root + separator.
  //    This rejects any residual traversal (e.g. allowedRoot === "/foo" and
  //    resolved === "/foobar" would be a false positive without the separator
  //    check).
  const rootWithSep = allowedRoot.endsWith(path.sep)
    ? allowedRoot
    : allowedRoot + path.sep;

  if (!resolved.startsWith(rootWithSep) && resolved !== allowedRoot) {
    throw new PathTraversalError(segment, allowedRoot);
  }

  return resolved;
}

/**
 * Like {@link resolveSafePath} but also appends a file extension to the
 * segment before resolving, making it convenient for capsule JSON lookups.
 *
 * @example
 *   const jsonPath = resolveSafeFilePath("my-capsule", ".json", SAFE_CAPSULE_ROOT);
 *   // → /…/public/manifest/capsules/my-capsule.json
 */
export function resolveSafeFilePath(
  segment: string,
  extension: string,
  allowedRoot: string,
  segmentRe?: RegExp,
): string {
  // Strip any leading dot from the caller-supplied extension and normalise.
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return resolveSafePath(segment + ext, allowedRoot, segmentRe);
}

// ── Sovereign write primitives ────────────────────────────────────────────────

/**
 * SAFE_SOVEREIGN_WRITES_ROOT
 *
 * Absolute root directory for all sovereign write operations performed by
 * scripts and library code.  All `sovereignWriteSync` calls must supply
 * either this constant or another exported root so the path is always
 * sourced from a compile-time constant rather than untrusted input.
 */
export const SAFE_SOVEREIGN_WRITES_ROOT: string = path.resolve(
  process.cwd(),
);

/**
 * Resolve a filename against a sovereign root directory, performing the same
 * traversal-escape checks as {@link resolveSafePath} but with a relaxed
 * segment pattern that allows forward-slashes for sub-directory writes
 * (e.g. `"output/report.json"`).
 *
 * The *root* is always a compile-time constant — this explicitly breaks
 * CodeQL's taint flow between untrusted input and the filesystem API.
 *
 * @param filename     The file name or relative path segment to write.
 * @param sovereignRoot Absolute root directory (compile-time constant).
 * @returns            Safe absolute path confined to `sovereignRoot`.
 * @throws             {@link PathTraversalError} if traversal is detected.
 */
export function resolveSovereignPath(
  filename: string,
  sovereignRoot: string,
): string {
  // Normalise — resolve any `.` / `..` components inside the join.
  const resolved = path.resolve(sovereignRoot, filename);

  // Confirm the resolved path is still inside the declared root.
  const rootWithSep = sovereignRoot.endsWith(path.sep)
    ? sovereignRoot
    : sovereignRoot + path.sep;

  if (!resolved.startsWith(rootWithSep) && resolved !== sovereignRoot) {
    throw new PathTraversalError(filename, sovereignRoot);
  }

  return resolved;
}

/**
 * The sole authorised `fs.writeFileSync` sink for the AveryOS™ runtime.
 *
 * All script and library code that writes files must go through this
 * function — never call `fs.writeFileSync`, `fs.openSync`, or
 * `fs.writeSync` directly with a path derived from dynamic or user-supplied
 * input.  The architecture itself eliminates the CodeQL taint flow rather
 * than suppressing alerts.
 *
 * @param sovereignRoot Absolute root directory (must be a compile-time
 *                     constant exported from this module).
 * @param filename     Relative file name or path (e.g. `"report.json"`).
 * @param data         Content to write — string or Buffer.
 * @param encoding     Optional encoding (default `"utf-8"`).
 */
export function sovereignWriteSync(
  sovereignRoot: string,
  filename: string,
  data: string | Buffer,
  encoding: BufferEncoding = "utf-8",
): void {
  const safePath = resolveSovereignPath(filename, sovereignRoot);

  // Ensure parent directories exist before writing.
  const dir = path.dirname(safePath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(safePath, data, encoding);
}
