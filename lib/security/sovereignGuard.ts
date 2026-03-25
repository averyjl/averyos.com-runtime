/**
 * lib/security/sovereignGuard.ts
 *
 * AveryOS™ Sovereign I/O Guard — Phase 122.6 GATE 122.6.1
 *
 * STRICT SANDBOX PATTERN
 * ----------------------
 * This module provides the AOS-GUARD strict sandbox:
 *   1. All writes are confined to a single compile-time-constant root
 *      (`VAULT_STORAGE_ROOT`).
 *   2. Path segments are *force-stripped* via `path.basename()` — no
 *      sub-directory traversal is possible.  The resolved path is always
 *      `<VAULT_STORAGE_ROOT>/<basename>`.
 *   3. Any attempt to construct a path that escapes the root throws a
 *      `SovereignGuardError`.
 *
 * This architecture explicitly breaks CodeQL's taint flow between
 * untrusted/dynamic input and the filesystem API — eliminating
 * `js/path-injection`, `js/non-literal-fs-filename`, and
 * `js/file-system-race` alerts without suppression comments.
 *
 * USAGE
 * -----
 *   import { guardedWrite, VAULT_STORAGE_ROOT } from "../security/sovereignGuard";
 *
 *   // Always writes to ./vault_storage/<basename> — never outside.
 *   guardedWrite("report.json", JSON.stringify(data));
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import fs   from "fs";
import path from "path";

// ── Compile-time-constant vault root ─────────────────────────────────────────

/**
 * The sole authorised write root for the AOS-GUARD strict sandbox.
 * All writes via `guardedWrite()` land here — no exceptions.
 */
export const VAULT_STORAGE_ROOT: string = path.resolve(
  process.cwd(),
  "vault_storage",
);

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Thrown when `guardedWrite` detects a path-construction attempt that
 * would place the output file outside `VAULT_STORAGE_ROOT`.
 */
export class SovereignGuardError extends Error {
  constructor(filename: string) {
    super(
      `sovereignGuard rejected filename '${filename}' — ` +
      `only simple filenames (no directory separators) are permitted. ` +
      `All writes must remain inside '${VAULT_STORAGE_ROOT}'.`,
    );
    this.name = "SovereignGuardError";
  }
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve `filename` to a safe absolute path inside `VAULT_STORAGE_ROOT`.
 *
 * Security properties:
 * - `path.basename()` strips every directory component, making traversal
 *   sequences (e.g. `../../etc/passwd`) impossible.
 * - The resolved path is verified to start with `VAULT_STORAGE_ROOT` as
 *   an additional defence-in-depth guard.
 *
 * @param filename  Any string; only the final segment (basename) is used.
 * @returns         Absolute path confined to `VAULT_STORAGE_ROOT`.
 * @throws          {@link SovereignGuardError} if the basename is empty or
 *                  the resolved path escapes the root.
 */
export function resolveGuardedPath(filename: string): string {
  // Strip every directory segment — this is the key security primitive.
  const safe = path.basename(filename);

  if (!safe || safe === "." || safe === "..") {
    throw new SovereignGuardError(filename);
  }

  const resolved = path.join(VAULT_STORAGE_ROOT, safe);

  // Defence-in-depth: confirm the resolved path is still inside the root.
  const rootWithSep = VAULT_STORAGE_ROOT.endsWith(path.sep)
    ? VAULT_STORAGE_ROOT
    : VAULT_STORAGE_ROOT + path.sep;

  if (!resolved.startsWith(rootWithSep)) {
    throw new SovereignGuardError(filename);
  }

  return resolved;
}

/**
 * The sole authorised `fs.writeFileSync` sink for the AOS-GUARD sandbox.
 *
 * Writes `data` to `<VAULT_STORAGE_ROOT>/<path.basename(filename)>`.
 * The destination directory is created automatically if it does not exist.
 *
 * @param filename  Destination filename (basename only; directories stripped).
 * @param data      Content to write — string or Buffer.
 * @param encoding  File encoding (default `"utf-8"`).
 */
export function guardedWrite(
  filename: string,
  data: string | Buffer,
  encoding: BufferEncoding = "utf-8",
): void {
  const safePath = resolveGuardedPath(filename);

  // Ensure the vault_storage directory exists before writing.
  fs.mkdirSync(VAULT_STORAGE_ROOT, { recursive: true });

  fs.writeFileSync(safePath, data, encoding);
}
