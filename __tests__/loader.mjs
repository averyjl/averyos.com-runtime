/**
 * __tests__/loader.mjs
 *
 * Custom Node.js ESM loader that resolves extensionless TypeScript imports.
 * The AveryOS™ source tree uses TypeScript convention (no .ts extension on imports),
 * which Node.js ESM can't resolve by default. This loader adds the .ts extension
 * automatically when the bare import resolves to an existing .ts file.
 *
 * Usage: node --loader ./__tests__/loader.mjs --experimental-strip-types --test ...
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  // Only try to extend relative imports without a file extension.
  // The regex matches a trailing dot followed by 1–5 alphanumeric characters
  // (case-insensitive), covering the most common extensions:
  //   .ts, .js, .mjs, .cjs, .tsx, .jsx, .json, .yaml, .html, .wasm, etc.
  // Imports without any extension (e.g. '../lib/sovereignConstants') are
  // the ones we need to resolve, so we invert the match.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !specifier.match(/\.[a-z]{1,5}$/i)
  ) {
    const parentDir = context.parentURL
      ? dirname(fileURLToPath(context.parentURL))
      : process.cwd();

    const tsCandidate = resolvePath(parentDir, specifier + ".ts");
    if (existsSync(tsCandidate)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(tsCandidate).href,
      };
    }
  }

  return nextResolve(specifier, context);
}
