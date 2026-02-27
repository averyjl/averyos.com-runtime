import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_VERSION } from '../../../../lib/sovereignConstants';

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

    // D1 Tether
    await cfEnv.DB.prepare('SELECT 1').first();
    const d1 = 'CONNECTED ✅';

    // KV Tether
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
    return Response.json({ status: 'DRIFT_DETECTED', error: message }, { status: 500 });
  }
}
