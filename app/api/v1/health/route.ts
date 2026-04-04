/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_VERSION } from '../../../../lib/sovereignConstants';
import { aosErrorResponse, AOS_ERROR } from '../../../../lib/sovereignError';

interface D1Database {
  prepare(query: string): { first: () => Promise<unknown> };
}

interface KVNamespace {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
}

interface CloudflareEnv {
  DB: D1Database;
  KV_LOGS: KVNamespace;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // D1 Tether — auto-heal: if DB binding missing, surface actionable error
    if (!cfEnv.DB) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, 'DB binding not found. Ensure [[d1_databases]] is configured in wrangler.toml.');
    }
    await cfEnv.DB.prepare('SELECT 1').first();
    const d1 = 'CONNECTED ✅';

    // KV Tether — auto-heal: if KV binding missing, surface actionable error
    if (!cfEnv.KV_LOGS) {
      return aosErrorResponse(AOS_ERROR.BINDING_MISSING, 'KV_LOGS binding not found. Ensure [[kv_namespaces]] is configured in wrangler.toml.');
    }
    const ts = new Date().toISOString();
    await cfEnv.KV_LOGS.put('health_ping', ts);
    await cfEnv.KV_LOGS.get('health_ping');
    const kv = 'CONNECTED ✅';

    return Response.json({
      status: 'SOVEREIGN_SYSTEM_ONLINE',
      kernel_version: KERNEL_VERSION,
      d1,
      d1_last_anchored: new Date().toISOString(),
      kv,
      kv_last_anchored: new Date().toISOString(),
      health_last_anchored: new Date().toISOString(),
      usb_salt: 'Local_Only',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (lower.includes('d1') || lower.includes('sqlite') || lower.includes('select 1')) {
      return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, message);
    }
    if (lower.includes('kv') || lower.includes('namespace')) {
      return aosErrorResponse(AOS_ERROR.KV_UNAVAILABLE, message);
    }
    return aosErrorResponse(AOS_ERROR.DRIFT_DETECTED, message);
  }
}
