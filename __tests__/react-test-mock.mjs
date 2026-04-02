/**
 * __tests__/react-test-mock.mjs
 *
 * Minimal React mock for testing React hooks in Node.js without a browser
 * or DOM environment.
 *
 * Implements only the hooks used by AveryOS™ lib/hooks/*.ts:
 *   - useState(initializer) — invokes the lazy initializer synchronously,
 *     returns [value, noop-setter].
 *   - useEffect(fn, deps)   — records the effect function; does NOT execute
 *     it immediately (mirrors the deferred nature of the real useEffect).
 *
 * This file is loaded by react-test-loader.mjs, which intercepts any
 * `import { ... } from "react"` statement inside test files and redirects
 * it here instead of the real react package.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// Captured effects list — reset between test runs via clearCapturedEffects()
let _capturedEffects = [];

export function useState(initializer) {
  const val = typeof initializer === "function" ? initializer() : initializer;
  return [val, () => {}];
}

export function useEffect(fn, _deps) {
  _capturedEffects.push(fn);
}

/** Returns all effects captured since the last clearCapturedEffects() call. */
export function getCapturedEffects() {
  return _capturedEffects.slice();
}

/** Clear the captured effects list. */
export function clearCapturedEffects() {
  _capturedEffects = [];
}
