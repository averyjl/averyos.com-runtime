/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * /api/v1/queues/log-consumer
 *
 * Cloudflare Queue Consumer — Sovereign Log Ingress (Phase 95.1)
 *
 * Processes batches of forensic log messages from the `sovereign-log-ingress`
 * queue, batch-writing up to 50 records at a time to D1 to prevent Surge Drift
 * and ensure 100.000% persistence during high-volume surges (25k+ witnesses).
 *
 * Queue binding: SOVEREIGN_LOG_QUEUE → sovereign-log-ingress
 *
 * Message payload schema (JSON):
 *   {
 *     event_type:    string   — e.g. "LEGAL_SCAN", "DER_PROBE"
 *     ip_address:    string   — client IP
 *     user_agent:    string   — User-Agent header
 *     geo_location:  string   — country/ASN identifier
 *     target_path:   string   — request pathname
 *     timestamp_ns:  string   — nanosecond epoch string
 *     threat_level:  number   — 0-10
 *     ray_id?:       string   — Cloudflare RayID
 *     kernel_sha?:   string   — KERNEL_SHA anchor
 *     ingestion_intent?: string — classification label
 *   }
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  batch(statements: D1PreparedStatement[]): Promise<{ success: boolean }[]>;
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB?: D1Database;
}

interface LogMessage {
  event_type:         string;
  ip_address:         string;
  user_agent:         string;
  geo_location:       string;
  target_path:        string;
  timestamp_ns:       string;
  threat_level:       number;
  ray_id?:            string;
  kernel_sha?:        string;
  ingestion_intent?:  string;
}

const BATCH_SIZE = 50;

/**
 * POST /api/v1/queues/log-consumer
 *
 * Internal health-check / status endpoint.  The Cloudflare Queue consumer
 * handler itself lives in the Worker's `queue` export (wrangler routes the
 * queue delivery outside the HTTP handler tree).  This HTTP endpoint lets
 * operators confirm the consumer route is deployed and returns current config.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // Require the Cloudflare cron/worker header or a passphrase for status checks
  const isWorker    = request.headers.get("cf-worker") === "true";
  const passphrase  = (env as Record<string, string | undefined>).VAULT_PASSPHRASE ?? "";
  const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!isWorker && (!passphrase || bearerToken !== passphrase)) {
    return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "Unauthorized.");
  }

  return Response.json({
    status:          "SOVEREIGN_LOG_CONSUMER_ACTIVE",
    queue:           "sovereign-log-ingress",
    dlq:             "sovereign-log-ingress-dlq",
    batch_size:      BATCH_SIZE,
    db_connected:    !!cfEnv.DB,
    kernel_version:  KERNEL_VERSION,
    kernel_sha:      KERNEL_SHA,
    checked_at:      formatIso9(new Date()),
  });
}

/**
 * Queue message batch handler.
 *
 * Called by the Cloudflare Worker runtime when messages arrive on
 * `sovereign-log-ingress`.  Writes records to D1 in batches of BATCH_SIZE
 * using D1's `batch()` API for efficiency.
 *
 * Not exported as an HTTP handler — this is a Worker queue consumer called
 * directly by the Cloudflare runtime outside the HTTP handler tree.
 * Not exported from this module to avoid Next.js route type violations;
 * re-exported via lib/queue/logConsumerHandler.ts for use in the Worker entry.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function processLogBatch(
  messages: { body: unknown; ack: () => void; retry: () => void }[],
  db: D1Database,
): Promise<void> {
  const validMessages: { stmt: D1PreparedStatement; msg: typeof messages[number] }[] = [];

  for (const msg of messages) {
    const body = msg.body as Partial<LogMessage>;

    // Basic validation — skip malformed messages
    if (
      !body.event_type ||
      typeof body.event_type !== "string" ||
      !body.timestamp_ns ||
      typeof body.timestamp_ns !== "string"
    ) {
      console.warn("[LOG_CONSUMER] Malformed message, skipping:", JSON.stringify(body).slice(0, 200));
      msg.ack(); // Acknowledge to prevent DLQ spam for permanently-bad messages
      continue;
    }

    const stmt = db.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path,
          timestamp_ns, threat_level, ray_id, kernel_sha, ingestion_intent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.event_type.toUpperCase().slice(0, 64),
      body.ip_address   ?? null,
      body.user_agent   ?? null,
      body.geo_location ?? null,
      body.target_path  ?? null,
      body.timestamp_ns,
      typeof body.threat_level === "number" ? body.threat_level : 0,
      body.ray_id          ?? null,
      body.kernel_sha      ?? KERNEL_SHA,
      body.ingestion_intent ?? null,
    );

    validMessages.push({ stmt, msg });
  }

  if (validMessages.length === 0) return;

  // Batch-write in slices of BATCH_SIZE to stay within D1 limits
  for (let i = 0; i < validMessages.length; i += BATCH_SIZE) {
    const slice = validMessages.slice(i, i + BATCH_SIZE);

    try {
      await db.batch(slice.map(v => v.stmt));
      // Acknowledge all messages in this slice on success
      for (const { msg } of slice) msg.ack();
    } catch (err: unknown) {
      console.error(
        "[LOG_CONSUMER] D1 batch write failed (slice starting at", i, "):",
        err instanceof Error ? err.message : String(err),
      );
      // Retry these messages so they go back on the queue (or to DLQ after max_retries)
      for (const { msg } of slice) msg.retry();
    }
  }
}
