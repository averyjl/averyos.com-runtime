/**
 * lib/geminiSpendTracker.ts
 *
 * Phase 88 — AveryOS™ Zero-Drift Gemini Spend Tracking
 *
 * Implements a fan-out write pattern for Gemini cost tracking.
 * Each inference call writes a unique KV key with spend metadata,
 * preventing the race condition that causes undercounting when multiple
 * Worker instances share a single aggregator key.
 *
 * Write:  recordGeminiSpend(kv, rayId, costUsd) → writes 'spend:gemini:<rayId>'
 * Read:   getTotalGeminiSpend(kv)               → lists keys + sums metadata
 *
 * "Undercounting is drift." — AveryOS™ Constitution v1.17, Art. 14
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

/** Minimal KV namespace interface required by the spend tracker. */
export interface SpendKvNamespace {
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
  ): Promise<void>;
  get(key: string): Promise<string | null>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> | null }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/** KV key prefix for per-call Gemini spend records. */
const SPEND_KEY_PREFIX = "spend:gemini:";

/** Key prefix for monthly aggregator buckets (current month, format YYYY-MM). */
const MONTHLY_PREFIX = "gemini-spend-";

/** TTL for per-call spend keys: 35 days (covers one full monthly billing cycle). */
const SPEND_KEY_TTL_SECONDS = 35 * 24 * 60 * 60;

/** Returns the current UTC month as a YYYY-MM string (e.g. "2026-03"). */
function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Record a single Gemini inference cost.
 *
 * Writes a unique KV key `spend:gemini:<rayId>` with cost + timestamp metadata.
 * The fan-out pattern ensures concurrent Worker invocations never overwrite
 * each other's spend records (each ray_id is globally unique per Cloudflare).
 *
 * @param kv       - KV_LOGS namespace binding
 * @param rayId    - Cloudflare Ray ID from cf-ray header (uniqueness anchor)
 * @param costUsd  - Estimated cost in USD for this inference call
 */
export async function recordGeminiSpend(
  kv: SpendKvNamespace,
  rayId: string,
  costUsd: number,
): Promise<void> {
  const key = `${SPEND_KEY_PREFIX}${rayId}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const mm     = getCurrentMonthKey();
  await kv.put(key, String(costUsd), {
    expirationTtl: SPEND_KEY_TTL_SECONDS,
    metadata: { cost_usd: costUsd, recorded_at: nowIso, month: mm },
  });
}

/**
 * Compute the total Gemini spend for the current calendar month.
 *
 * Lists all `spend:gemini:*` keys and sums the `cost_usd` metadata field.
 * Falls back to reading the legacy single-key aggregator (`gemini-spend-YYYY-MM`)
 * if no fan-out keys exist yet (zero-downtime migration path).
 *
 * @param kv - KV_LOGS namespace binding
 * @returns Total spend in USD for the current month
 */
export async function getTotalGeminiSpend(kv: SpendKvNamespace): Promise<number> {
  // ── Fan-out aggregation: list all per-call keys and sum metadata ────────────
  const currentMonth = getCurrentMonthKey();
  let total      = 0;
  let cursor: string | undefined;
  let hasAnyKeys = false;

  do {
    const page = await kv.list({
      prefix: SPEND_KEY_PREFIX,
      limit:  1000,
      cursor,
    });

    for (const key of page.keys) {
      const meta = key.metadata as { cost_usd?: number; month?: string } | null;
      if (meta?.month === currentMonth && typeof meta.cost_usd === "number") {
        total += meta.cost_usd;
        hasAnyKeys = true;
      }
    }

    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  // ── Legacy fallback: read single aggregator key if no fan-out keys found ────
  if (!hasAnyKeys) {
    const legacyKey   = `${MONTHLY_PREFIX}${currentMonth}`;
    const legacyValue = await kv.get(legacyKey);
    if (legacyValue != null) {
      const parsed = parseFloat(legacyValue);
      if (!isNaN(parsed)) total = parsed;
    }
  }

  return total;
}

/**
 * Check whether the monthly Gemini credit ceiling has been reached.
 *
 * @param kv           - KV_LOGS namespace binding
 * @param limitUsd     - Monthly spend ceiling in USD (default $50)
 * @returns true if accumulated spend ≥ limit
 */
export async function isGeminiCreditExhausted(
  kv: SpendKvNamespace,
  limitUsd = 50,
): Promise<boolean> {
  try {
    const total = await getTotalGeminiSpend(kv);
    return total >= limitUsd;
  } catch {
    return false;
  }
}
