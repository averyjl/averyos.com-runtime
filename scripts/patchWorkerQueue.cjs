/**
 * scripts/patchWorkerQueue.cjs
 *
 * Post-build patch — Sovereign Queue Consumer Hardlock (Phase 112 GATE 112.1)
 *
 * Injects an async `queue()` handler export into `.open-next/worker.js` after
 * the OpenNext Cloudflare build has completed.  This resolves Cloudflare Worker
 * error 11001 ("No queue consumers found") which occurs when `wrangler.toml`
 * defines a `[[queues.consumers]]` binding but the Worker entrypoint does not
 * export a `queue()` function.
 *
 * The injected handler:
 *   • Receives batches from the `sovereign-log-ingress` queue.
 *   • Writes valid log records to the `sovereign_audit_logs` D1 table.
 *   • Acknowledges malformed messages immediately (no DLQ spam).
 *   • Retries on transient D1 write failures (up to Cloudflare max_retries).
 *
 * NOTE ON INTENTIONAL DUPLICATION:
 *   The queue handler logic below mirrors `lib/queue/logConsumerHandler.ts`.
 *   This duplication is necessary because:
 *     1. `.open-next/worker.js` is a plain-JS ES module bundle — it cannot
 *        perform dynamic `require()` calls into TypeScript source files.
 *     2. The OpenNext build has already bundled all TypeScript at the time
 *        this patch runs, so we cannot import from `lib/` at patch time.
 *     3. The self-contained approach keeps the Worker entrypoint portable and
 *        avoids re-running the TypeScript compiler as part of this patch step.
 *   The canonical source of truth is `lib/queue/logConsumerHandler.ts`.
 *   Any changes to the queue processing logic must be applied to BOTH files.
 *   The `_SOVEREIGN_BATCH_SIZE` constant (50) intentionally matches `BATCH_SIZE`
 *   in the TypeScript module.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
"use strict";

const fs           = require("fs");
const path         = require("path");
const { execSync } = require("child_process");

const WORKER_JS = path.join(__dirname, "../.open-next/worker.js");

if (!fs.existsSync(WORKER_JS)) {
  console.warn("⚠️  patchWorkerQueue: .open-next/worker.js not found — run build:cloudflare first");
  process.exit(0);
}

// Keep a copy of the original so we can revert if the post-patch syntax check fails.
const originalContent = fs.readFileSync(WORKER_JS, "utf8");
let content = originalContent;

// Sentinel to detect if patch was already applied
const PATCH_SENTINEL = "/* SOVEREIGN_QUEUE_CONSUMER_v112 */";

if (content.includes(PATCH_SENTINEL)) {
  console.log("✅ patchWorkerQueue: .open-next/worker.js already patched (queue consumer)");
  process.exit(0);
}

// ── Validate the default export exists ───────────────────────────────────────

if (!content.includes("export default {")) {
  console.warn("⚠️  patchWorkerQueue: 'export default {' not found in worker.js — adapter may have changed, skipping");
  process.exit(0);
}

// ── Sovereign Queue Handler implementation ────────────────────────────────────
// Inline JavaScript — no external imports so the patch is self-contained.

const QUEUE_HANDLER_CODE = `
${PATCH_SENTINEL}
// ── Sovereign Queue Consumer — Phase 112 GATE 112.1 ──────────────────────────
// Handles batches from the sovereign-log-ingress Cloudflare Queue.
// Writes valid forensic log records to the sovereign_audit_logs D1 table.
const _SOVEREIGN_BATCH_SIZE = 50;
async function _sovereignQueueHandler(batch, env) {
  const db = env.DB;
  if (!db) {
    console.error("[SOVEREIGN_QUEUE] D1 binding (DB) unavailable — retrying all messages");
    for (const msg of batch.messages) msg.retry();
    return;
  }
  const valid = [];
  for (const msg of batch.messages) {
    const body = msg.body;
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
      "INSERT INTO sovereign_audit_logs " +
      "(event_type, ip_address, user_agent, geo_location, target_path, " +
      "timestamp_ns, threat_level, ray_id, kernel_sha, ingestion_intent) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      body.event_type.toUpperCase().slice(0, 64),
      typeof body.ip_address       === "string" ? body.ip_address       : null,
      typeof body.user_agent       === "string" ? body.user_agent       : null,
      typeof body.geo_location     === "string" ? body.geo_location     : null,
      typeof body.target_path      === "string" ? body.target_path      : null,
      body.timestamp_ns,
      typeof body.threat_level     === "number" ? body.threat_level     : 0,
      typeof body.ray_id           === "string" ? body.ray_id           : null,
      typeof body.kernel_sha       === "string" ? body.kernel_sha       : null,
      typeof body.ingestion_intent === "string" ? body.ingestion_intent : null
    );
    valid.push({ stmt, msg });
  }
  if (valid.length === 0) return;
  for (let i = 0; i < valid.length; i += _SOVEREIGN_BATCH_SIZE) {
    const slice = valid.slice(i, i + _SOVEREIGN_BATCH_SIZE);
    try {
      await db.batch(slice.map(v => v.stmt));
      for (const { msg } of slice) msg.ack();
    } catch (err) {
      console.error("[SOVEREIGN_QUEUE] D1 batch write failed (slice " + i + "):", err && err.message ? err.message : String(err));
      for (const { msg } of slice) msg.retry();
    }
  }
}
`;

// ── Inject handler + extend the default export ───────────────────────────────

// Add the handler code before `export default {`
const EXPORT_MARKER = "export default {";
const insertIndex   = content.lastIndexOf(EXPORT_MARKER);

if (insertIndex === -1) {
  console.warn("⚠️  patchWorkerQueue: could not locate 'export default {' — skipping");
  process.exit(0);
}

content = content.slice(0, insertIndex) + QUEUE_HANDLER_CODE + content.slice(insertIndex);

// Extend the default export object with the queue handler.
// The Worker template ends with:  export default { async fetch(...) { ... } };
// We need to change it to:        export default { async fetch(...) { ... }, queue: _sovereignQueueHandler };
//
// Strategy: find the last `};` (the closing of the default export) and replace
// it with `,\n  queue: _sovereignQueueHandler,\n};`
//
// To be safe, we look for the pattern `};\n` or `};\r\n` at end of file.

const CLOSE_EXPORT = /\};\s*$/.exec(content);
if (!CLOSE_EXPORT) {
  console.warn("⚠️  patchWorkerQueue: could not locate closing '};' of default export — skipping");
  process.exit(0);
}

const closeIndex = content.lastIndexOf(CLOSE_EXPORT[0]);
const beforeClose = content.slice(0, closeIndex);

// The OpenNext worker template adds a trailing comma after the last property
// (e.g. `  },` before the closing `};`).  Prepending ANOTHER `,` would create
// a double-comma syntax error that wrangler rejects with "Expected identifier".
// Only add the comma separator when the content before `};` does NOT already
// end with one.
const alreadyHasTrailingComma = /,\s*$/.test(beforeClose);
const separator = alreadyHasTrailingComma ? "" : ",";
content = beforeClose + separator + "\n  queue: _sovereignQueueHandler,\n};\n";

// ── Post-patch syntax validation ──────────────────────────────────────────────
// Validate the patched JS with `node --check` before writing so that any future
// OpenNext template changes are caught HERE (with a clear error + auto-revert)
// rather than as a cryptic wrangler build failure downstream.
try {
  // Write to a temp file first so we can check without overwriting the original.
  const tmpFile = WORKER_JS + ".patch-check.tmp";
  fs.writeFileSync(tmpFile, content, "utf8");
  try {
    execSync(`node --check "${tmpFile}"`, { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
} catch (syntaxErr) {
  const msg = syntaxErr.stderr ? syntaxErr.stderr.toString().trim() : String(syntaxErr);
  console.error("⚠️  patchWorkerQueue: post-patch syntax check FAILED — reverting to original.");
  console.error("   This means the OpenNext worker.js format has changed.");
  console.error("   Error:", msg.split("\n")[0]);
  console.error("   worker.js left untouched. Investigate patchWorkerQueue.cjs before redeploying.");
  // Leave the original file unchanged.
  process.exit(1);
}

fs.writeFileSync(WORKER_JS, content, "utf8");
console.log("✅ patchWorkerQueue: injected sovereign queue consumer into .open-next/worker.js (Phase 112 GATE 112.1)");
