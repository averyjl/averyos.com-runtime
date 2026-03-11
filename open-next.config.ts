// open-next.config.ts - Configuration for @opennextjs/cloudflare adapter
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

/**
 * Cron trigger route mapping — AveryOS™ Phase 107 Gate 1
 *
 * The */5 cron fires every 5 minutes and invokes:
 *   1. /api/v1/cron/package-evidence  — R2 forensic bundle packaging (Phase 82)
 *   2. /api/v1/cron/clock-escalation  — Compliance clock escalation + KaaS auto-settle
 *
 * The 0 7 daily cron fires at 07:00 UTC and invokes:
 *   1. /api/v1/cron/reconcile         — Stripe vs D1 reconciliation (Phase 93.5)
 *
 * Both cron schedules are defined in wrangler.toml [triggers].
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
export default defineCloudflareConfig();
