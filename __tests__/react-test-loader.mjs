/**
 * __tests__/react-test-loader.mjs
 *
 * Node.js custom ESM loader that intercepts `react` module resolution and
 * redirects it to the minimal test mock at `./__tests__/react-test-mock.mjs`.
 *
 * Usage:
 *   node --loader ./__tests__/loader.mjs \
 *        --loader ./__tests__/react-test-loader.mjs \
 *        --experimental-strip-types --test __tests__/useComplianceWindow.test.ts
 *
 * This loader only redirects the bare `react` specifier — all other imports
 * pass through to the default Node.js resolver unchanged.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REACT_MOCK_URL = pathToFileURL(
  resolvePath(__dirname, "react-test-mock.mjs"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react") {
    return {
      shortCircuit: true,
      url: REACT_MOCK_URL,
    };
  }
  return nextResolve(specifier, context);
}
