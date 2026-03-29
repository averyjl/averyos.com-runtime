/**
 * __tests__/cloudflare-mock.mjs
 *
 * Minimal stub for `@opennextjs/cloudflare` used during unit testing.
 *
 * Provides a no-op getCloudflareContext() that returns an empty env
 * and a synthetic request. The proxy() function in lib/security/proxy.ts
 * calls this to obtain Cloudflare KV / D1 / R2 bindings; returning empty
 * stubs lets tests exercise the function's logic paths without a Worker
 * runtime.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export function getCloudflareContext() {
  return {
    env: {},
    cf: {},
    ctx: {
      waitUntil: () => {},
      passThroughOnException: () => {},
    },
  };
}
