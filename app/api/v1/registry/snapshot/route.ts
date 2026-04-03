/**
 * app/api/v1/registry/snapshot/route.ts
 *
 * GET /api/v1/registry/snapshot
 *
 * Serves a live JSON snapshot of the AveryOS™ sovereign capsule registry —
 * the same data that populates the VaultChain™ Explorer and the admin
 * dashboard, fetched from KV (if available) or the statically-compiled
 * manifest at build time.
 *
 * Priority read order (ensures latest data in both dev and edge runtimes):
 *   1. SOVEREIGN_KV key `capsule:registry:snapshot` (live KV cache, 5-min TTL)
 *   2. Built-in capsule registry via `listRegistryCapsules()` (Next.js static
 *      manifest — always available, always the build-time ground truth)
 *
 * Response shape:
 *   {
 *     generatedAt: string;        // ISO-8601 timestamp
 *     count: number;              // total capsule count
 *     capsules: CapsuleRegistryItem[];
 *     kernel_version: string;
 *     kernel_sha: string;
 *   }
 *
 * GATE 118.3 — Priority 🔥2: API route for Registry
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { listRegistryCapsules, loadCapsuleRegistry } from "../../../../../lib/capsuleRegistry";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";

// Minimal KV namespace interface (avoids importing @cloudflare/workers-types)
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface CloudflareEnv {
  SOVEREIGN_KV?: KVNamespace;
}

/**
 * GET /api/v1/registry/snapshot
 *
 * Returns the live capsule registry snapshot with kernel anchor metadata.
 */
export async function GET() {
  try {
    // ── 1. Try KV live cache first ───────────────────────────────────────────
    type RegistrySnapshot = {
      generatedAt: string;
      count: number;
      capsules: Awaited<ReturnType<typeof listRegistryCapsules>>;
    };
    let cachedSnapshot: RegistrySnapshot | null = null;

    try {
      // getCloudflareContext is a no-op outside the Workers runtime; wrap in
      // try/catch so the route still works in the Next.js dev server.
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = await getCloudflareContext({ async: true });
      const cfEnv = env as unknown as CloudflareEnv;

      if (cfEnv?.SOVEREIGN_KV) {
        const raw = await cfEnv.SOVEREIGN_KV.get("capsule:registry:snapshot");
        if (raw) {
          cachedSnapshot = JSON.parse(raw) as RegistrySnapshot;
        }
      }
    } catch {
      // getCloudflareContext not available (dev mode) — fall through to static
    }

    if (cachedSnapshot) {
      return Response.json(
        {
          ...cachedSnapshot,
          kernel_version: KERNEL_VERSION,
          kernel_sha:     KERNEL_SHA,
          source:         "kv_cache",
        },
        {
          headers: {
            "Cache-Control": "public, max-age=60, s-maxage=300",
          },
        },
      );
    }

    // ── 2. Fall back to statically-compiled manifest ─────────────────────────
    const registry  = await loadCapsuleRegistry();
    const capsules  = await listRegistryCapsules();

    const snapshot = {
      generatedAt:    registry?.generatedAt ?? new Date().toISOString(),
      count:          capsules.length,
      capsules,
      kernel_version: KERNEL_VERSION,
      kernel_sha:     KERNEL_SHA,
      source:         "static_manifest",
    };

    // Optionally back-fill KV so the next request is faster
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = await getCloudflareContext({ async: true });
      const cfEnv = env as unknown as CloudflareEnv;

      if (cfEnv?.SOVEREIGN_KV) {
        // Cache for 5 minutes (300 s)
        cfEnv.SOVEREIGN_KV.put(
          "capsule:registry:snapshot",
          JSON.stringify({ generatedAt: snapshot.generatedAt, count: snapshot.count, capsules }),
          { expirationTtl: 300 },
        ).catch(() => {
          // fire-and-forget; don't fail the response on KV write error
        });
      }
    } catch {
      // not in Workers runtime — skip KV back-fill
    }

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
