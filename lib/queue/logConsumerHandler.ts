/**
 * lib/queue/logConsumerHandler.ts
 *
 * Sovereign Queue Consumer Handler — AveryOS™ Phase 112 GATE 112.1
 *
 * Exports the Cloudflare Worker `queue()` handler for the `sovereign-log-ingress`
 * queue binding.  This handler is injected into the OpenNext Worker entrypoint
 * by `scripts/patchWorkerQueue.cjs` during `build:cloudflare` so that Cloudflare
 * does not raise error 11001 ("No queue consumers found").
 *
 * Message payload schema (JSON):
 *   {
 *     event_type:        string   — e.g. "LEGAL_SCAN", "DER_PROBE"
 *     ip_address:        string   — client IP
 *     user_agent:        string   — User-Agent header
 *     geo_location:      string   — country/ASN identifier
 *     target_path:       string   — request pathname
 *     timestamp_ns:      string   — nanosecond epoch string
 *     threat_level:      number   — 0–10
 *     ray_id?:           string   — Cloudflare RayID
 *     kernel_sha?:       string   — KERNEL_SHA anchor
 *     ingestion_intent?: string   — classification label
 *   }
 *
 * Queue binding: SOVEREIGN_LOG_QUEUE → sovereign-log-ingress
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA } from "../sovereignConstants";

// ── Local type interfaces ─────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  batch(statements: D1PreparedStatement[]): Promise<{ success: boolean }[]>;
  prepare(query: string): D1PreparedStatement;
}

interface SovereignQueueEnv {
  DB?: D1Database;
}

interface LogMessageBody {
  event_type?:        unknown;
  ip_address?:        unknown;
  user_agent?:        unknown;
  geo_location?:      unknown;
  target_path?:       unknown;
  timestamp_ns?:      unknown;
  threat_level?:      unknown;
  ray_id?:            unknown;
  kernel_sha?:        unknown;
  ingestion_intent?:  unknown;
}

interface QueueMessage {
  body: unknown;
  ack(): void;
  retry(): void;
}

interface MessageBatch {
  messages: QueueMessage[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * Cloudflare Worker `queue()` export for the `sovereign-log-ingress` binding.
 *
 * Processes incoming forensic log messages in batches of up to BATCH_SIZE,
 * writing each valid record to the `sovereign_audit_logs` D1 table.  Malformed
 * messages are acknowledged immediately to prevent DLQ spam; transient write
 * failures trigger a retry so messages are re-delivered (up to max_retries).
 *
 * @param batch  The MessageBatch delivered by Cloudflare.
 * @param env    Cloudflare Worker environment bindings (must include `DB`).
 */
export async function sovereignQueueHandler(
  batch: MessageBatch,
  env: SovereignQueueEnv,
): Promise<void> {
  const db = env.DB;

  if (!db) {
    console.error("[SOVEREIGN_QUEUE] D1 binding (DB) not available — retrying all messages");
    for (const msg of batch.messages) msg.retry();
    return;
  }

  const valid: { stmt: D1PreparedStatement; msg: QueueMessage }[] = [];

  for (const msg of batch.messages) {
    const body = msg.body as LogMessageBody;

    if (
      !body ||
      typeof body.event_type !== "string" ||
      !body.event_type ||
      typeof body.timestamp_ns !== "string" ||
      !body.timestamp_ns
    ) {
      console.warn("[SOVEREIGN_QUEUE] Malformed message — acking:", JSON.stringify(body ?? "").slice(0, 200));
      msg.ack();
      continue;
    }

    const stmt = db.prepare(
      `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, user_agent, geo_location, target_path,
          timestamp_ns, threat_level, ray_id, kernel_sha, ingestion_intent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      (body.event_type as string).toUpperCase().slice(0, 64),
      typeof body.ip_address        === "string" ? body.ip_address        : null,
      typeof body.user_agent        === "string" ? body.user_agent        : null,
      typeof body.geo_location      === "string" ? body.geo_location      : null,
      typeof body.target_path       === "string" ? body.target_path       : null,
      body.timestamp_ns as string,
      typeof body.threat_level      === "number" ? body.threat_level      : 0,
      typeof body.ray_id            === "string" ? body.ray_id            : null,
      (() => {
        if (typeof body.kernel_sha === "string") return body.kernel_sha;
        console.warn("[SOVEREIGN_QUEUE] kernel_sha missing in message — defaulting to KERNEL_SHA anchor");
        return KERNEL_SHA;
      })(),
      typeof body.ingestion_intent  === "string" ? body.ingestion_intent  : null,
    );

    valid.push({ stmt, msg });
  }

  if (valid.length === 0) return;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const slice = valid.slice(i, i + BATCH_SIZE);
    try {
      await db.batch(slice.map(v => v.stmt));
      for (const { msg } of slice) msg.ack();
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[SOVEREIGN_QUEUE] D1 batch write failed (slice ${i}):`, detail);
      for (const { msg } of slice) msg.retry();
    }
  }
}
