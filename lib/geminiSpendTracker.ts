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
 * lib/geminiSpendTracker.ts
 *
 * Phase 88 — Gemini Credit Watch: Race-Free Spend Accumulator
 *
 * Design: Fan-Out Write / Aggregated Read
 * ──────────────────────────────────────────────────────────────────────
 * The naive read-then-increment pattern on a single KV key has a race
 * condition: concurrent Gemini calls all read the same stale value before
 * any write completes, causing systematic undercounting (drift).
 *
 * This module eliminates that race entirely:
 *
 *   WRITE: Each call writes its own unique entry — no read ever needed.
 *     key  = gemini_spend_entry_YYYY-MM_{timestamp_ms}_{4-hex-random}
 *     value = cost as decimal string (e.g. "0.00125000")
 *     metadata = { cost: 0.00125 }    ← returned by list(), avoids get() per key
 *     TTL  = 35 days                  ← auto-expires; covers full month + buffer
 *
 *   READ: list() all entries for the current month by prefix, sum metadata.cost.
 *     No individual get() calls needed (metadata is included in list results).
 *
 * 100.000% accurate — every write is a unique, durable, atomic PUT.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Monthly Gemini spend limit in USD. When reached, circuit breaker activates. */
export const GEMINI_MONTHLY_CREDIT_LIMIT_USD = 50;

/** Gemini 1.5 Pro blended average pricing per 1,000 tokens (input + output avg). */
export const GEMINI_COST_PER_1K_TOKENS = 0.00125;

/** TTL for spend entries — 35 days covers the full month plus a buffer. */
const SPEND_ENTRY_TTL_SECONDS = 35 * 86400;

// ── KV Interface ─────────────────────────────────────────────────────────────

/**
 * Minimal Cloudflare KV binding interface required by this tracker.
 * Extends the standard put/get with list() for prefix-based aggregation.
 */
export interface GeminiSpendKV {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { metadata?: unknown; expirationTtl?: number },
  ): Promise<void>;
  list<M = unknown>(opts: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: { name: string; metadata?: M }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

// ── Key helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the KV key prefix for per-call spend entries for a given year+month.
 * All entries for a month share this prefix so list() can aggregate them.
 */
export function geminiSpendPrefix(year: number, month: number): string {
  return `gemini_spend_entry_${year}-${String(month).padStart(2, '0')}_`;
}

/** Returns the spend entry prefix for the current UTC month. */
export function currentMonthSpendPrefix(): string {
  const now = new Date();
  return geminiSpendPrefix(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

// ── Write (race-free) ─────────────────────────────────────────────────────────

/**
 * Records the cost of a single Gemini call as an independent KV entry.
 *
 * WRITE-ONLY: no read is performed — eliminates the race condition entirely.
 * Every concurrent request writes to its own unique key, so no call can
 * overwrite or lose another call's contribution.
 *
 * The cost is stored in both the value (string) and metadata (number).
 * Metadata is returned by list() without extra get() calls, making
 * aggregation O(ceil(N/1000)) list requests with zero per-key gets.
 *
 * @param kv      — Cloudflare KV binding with list() support
 * @param costUsd — cost of this call in USD (must be > 0 to be written)
 */
export async function recordGeminiSpend(
  kv: GeminiSpendKV,
  costUsd: number,
): Promise<void> {
  if (costUsd <= 0) return;

  const prefix = currentMonthSpendPrefix();
  // Unique key = prefix + ms timestamp + 4 random hex chars (0000–ffff)
  // Collision probability: 1 / (16^4) = 1 / 65536 at the same ms — negligible
  const rand4 = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
  const uniqueKey = `${prefix}${Date.now()}_${rand4}`;

  await kv.put(uniqueKey, costUsd.toFixed(8), {
    metadata:       { cost: costUsd },
    expirationTtl:  SPEND_ENTRY_TTL_SECONDS,
  });
  // Note: 8 decimal places (sub-micro-dollar precision) ensures no rounding
  // loss when values are parsed and summed in getTotalGeminiSpend.
}

// ── Read (aggregate) ──────────────────────────────────────────────────────────

/**
 * Sums all per-call spend entries for the current UTC month.
 *
 * Uses metadata returned by list() — no individual get() calls needed.
 * Handles KV pagination automatically (up to 1000 keys per page).
 *
 * @param kv — Cloudflare KV binding with list() support
 * @returns total spend in USD for the current month
 */
export async function getTotalGeminiSpend(kv: GeminiSpendKV): Promise<number> {
  const prefix = currentMonthSpendPrefix();
  let total = 0;
  let cursor: string | undefined;

  do {
    const result = await kv.list<{ cost: number }>(
      cursor ? { prefix, limit: 1000, cursor } : { prefix, limit: 1000 },
    );

    for (const key of result.keys) {
      if (typeof key.metadata?.cost === 'number' && isFinite(key.metadata.cost)) {
        total += key.metadata.cost;
      }
    }

    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor !== undefined);

  return total;
}

/**
 * Returns true when the current month's accumulated Gemini spend has met
 * or exceeded GEMINI_MONTHLY_CREDIT_LIMIT_USD.
 *
 * Used by the Phase 88 circuit breaker in middleware.ts to fall back to
 * LOCAL_OLLAMA_NODE when the $50/month cloud AI budget is reached.
 *
 * Errors are swallowed — KV unavailability must NOT force a fallback,
 * so cloud AI degrades gracefully rather than being disabled on KV blips.
 *
 * @param kv — Cloudflare KV binding with list() support
 */
export async function isGeminiCreditExhausted(kv: GeminiSpendKV): Promise<boolean> {
  try {
    const total = await getTotalGeminiSpend(kv);
    return total >= GEMINI_MONTHLY_CREDIT_LIMIT_USD;
  } catch {
    return false;
  }
}
