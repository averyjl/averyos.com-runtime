// open-next.config.ts - Configuration for @opennextjs/cloudflare adapter
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

/**
 * Cron trigger route mapping — AveryOS™ Phase 107 Gate 1 / Phase 110.1
 *
 * The every-5-minute cron fires and invokes:
 *   1. /api/v1/cron/package-evidence  — R2 forensic bundle packaging (Phase 82)
 *   2. /api/v1/cron/clock-escalation  — Compliance clock escalation + KaaS auto-settle
 *   3. /api/v1/time/sovereign         — Sovereign Time Mesh D1 snapshot (Phase 110.1)
 *
 * The 0 7 daily cron fires at 07:00 UTC and invokes:
 *   1. /api/v1/cron/reconcile         — Stripe vs D1 reconciliation (Phase 93.5)
 *
 * Both cron schedules are defined in wrangler.toml [triggers].
 *
 * ── Sovereign Queue Consumer — Phase 112 GATE 112.1 ──────────────────────────
 *
 * The `sovereign-log-ingress` Cloudflare Queue consumer is wired into the
 * Worker entrypoint by `scripts/patchWorkerQueue.cjs`, which runs as the final
 * step of `build:cloudflare` and injects an async `queue()` export into
 * `.open-next/worker.js`.  The handler logic lives in
 * `lib/queue/logConsumerHandler.ts` and writes batched forensic log records to
 * the `sovereign_audit_logs` D1 table.
 *
 * This resolves Cloudflare Worker error 11001 ("No queue consumers found")
 * caused by the `[[queues.consumers]]` binding in wrangler.toml requiring a
 * `queue()` export that the vanilla OpenNext Worker template does not provide.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
export default defineCloudflareConfig();
