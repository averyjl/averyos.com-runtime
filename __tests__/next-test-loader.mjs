/**
 * __tests__/next-test-loader.mjs
 *
 * Node.js custom ESM loader for testing modules that depend on
 * `next/server` and `@opennextjs/cloudflare`. Intercepts those
 * bare-specifier imports and redirects them to lightweight test stubs
 * so the unit tests can run in a pure Node.js environment without a
 * full Next.js + Cloudflare Workers build.
 *
 * Usage:
 *   node --loader ./__tests__/loader.mjs \
 *        --loader ./__tests__/next-test-loader.mjs \
 *        --experimental-strip-types --test __tests__/generated/proxy.gen.test.ts
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NEXT_SERVER_MOCK_URL = pathToFileURL(
  resolvePath(__dirname, "next-server-mock.mjs"),
).href;

const CLOUDFLARE_MOCK_URL = pathToFileURL(
  resolvePath(__dirname, "cloudflare-mock.mjs"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server" || specifier === "next/server.js") {
    return { shortCircuit: true, url: NEXT_SERVER_MOCK_URL };
  }
  if (specifier === "@opennextjs/cloudflare") {
    return { shortCircuit: true, url: CLOUDFLARE_MOCK_URL };
  }
  return nextResolve(specifier, context);
}
