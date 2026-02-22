/**
 * Sovereign System Health Check
 * Author: Jason Lee Avery (ROOT0)
 * Verifies both the D1 database tether and the KV_LOGS tether.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

const KERNEL_VERSION = "v3.6.2";

// Minimal inline types for the Cloudflare bindings used in this route.
// The global CloudflareEnv interface (declared by @opennextjs/cloudflare) is
// augmented here so getCloudflareContext() exposes env.DB and env.KV_LOGS.
interface D1PreparedStatement {
  run(): Promise<unknown>;
}
interface D1Binding {
  prepare(query: string): D1PreparedStatement;
}
interface KVBinding {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
}
declare global {
  interface CloudflareEnv {
    DB: D1Binding;
    KV_LOGS: KVBinding;
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus: "CONNECTED" | "OFFLINE" = "OFFLINE";
  let kvStatus: "CONNECTED" | "OFFLINE" = "OFFLINE";

  const { env } = await getCloudflareContext({ async: true });

  try {
    await env.DB.prepare("SELECT 1").run();
    dbStatus = "CONNECTED";
  } catch {
    // D1 tether offline — status remains OFFLINE
  }

  try {
    await env.KV_LOGS.put("ping", timestamp);
    const readback = await env.KV_LOGS.get("ping");
    if (readback !== null) {
      kvStatus = "CONNECTED";
    }
  } catch {
    // KV tether offline — status remains OFFLINE
  }

  const hasDrift = dbStatus === "OFFLINE" || kvStatus === "OFFLINE";

  return Response.json({
    status: hasDrift ? "DRIFT_DETECTED" : "ANCHORED",
    kernel_version: KERNEL_VERSION,
    timestamp,
    tethers: {
      d1_database: dbStatus,
      kv_logs: kvStatus,
    },
  });
}
