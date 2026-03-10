/**
 * lib/stripe/syncRevenue.ts
 *
 * Stripe Revenue Sync — AveryOS™ Phase 105 GATE 105.4
 *
 * Fetches live settlement totals from the Stripe API and computes the
 * "Genesis Dollar Anchor" — the running sum of all verified alignment
 * payments against the sovereign kernel.
 *
 * Used by:
 *   • app/admin/monetization/page.tsx  — Stripe Revenue Dashboard
 *   • app/admin/settlements/page.tsx   — Admin Settlement Dashboard
 *   • app/api/v1/stripe/revenue/route.ts (new endpoint)
 *
 * All amounts are in USD cents (integer arithmetic) to avoid float issues.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Stripe API types (minimal) ─────────────────────────────────────────────────
interface StripeSession {
  id:                string;
  amount_total:      number | null;
  currency:          string;
  customer_email:    string | null;
  created:           number;
  payment_status:    string;
  metadata:          Record<string, string>;
}

interface StripeListResponse<T> {
  object:   "list";
  data:     T[];
  has_more: boolean;
}

// ── Revenue snapshot ──────────────────────────────────────────────────────────

export interface RevenueSnapshot {
  /** Total collected in USD cents across all settled sessions. */
  collectedCents:       number;
  /** Total collected formatted as a USD string. */
  collectedDisplay:     string;
  /** Number of completed sessions included in this snapshot. */
  sessionCount:         number;
  /** Most recent session timestamp (Unix seconds), or 0 if none. */
  latestSessionTs:      number;
  /** "Genesis Dollar Anchor" — first ever payment timestamp, or 0 if none. */
  genesisTs:            number;
  /** Genesis payment amount in USD cents. */
  genesisCents:         number;
  /** ISO-8601 timestamp of when this snapshot was computed. */
  snapshotAt:           string;
  /** Kernel version this snapshot was generated under. */
  kernelVersion:        string;
  /** SHA-512 anchor of this snapshot payload. */
  anchorSha:            string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function centsToDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Minimal SHA-512 anchor for the snapshot (Web Crypto, Cloudflare-compatible). */
async function anchorPayload(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Core fetch ─────────────────────────────────────────────────────────────────

/**
 * Fetch all `checkout.session.completed` events from Stripe for the given
 * look-back window, sum totals, and return a {@link RevenueSnapshot}.
 *
 * @param stripeSecretKey  STRIPE_SECRET_KEY env value
 * @param lookbackDays     How many days to look back (default 90)
 */
export async function syncStripeRevenue(
  stripeSecretKey: string,
  lookbackDays = 90,
): Promise<RevenueSnapshot> {
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is required");

  const since = Math.floor(Date.now() / 1000) - lookbackDays * 86_400;
  let collectedCents  = 0;
  let sessionCount    = 0;
  let latestTs        = 0;
  let genesisTs       = Number.MAX_SAFE_INTEGER;
  let genesisCents    = 0;
  let startingAfter: string | undefined;

  // Paginate through all completed sessions in the look-back window
  do {
    const params = new URLSearchParams({
      "created[gte]": String(since),
      limit:          "100",
    });
    if (startingAfter) params.set("starting_after", startingAfter);

    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Stripe-Version": "2024-06-20",
        },
      },
    );
    if (!resp.ok) {
      throw new Error(`Stripe API error: ${resp.status} ${await resp.text()}`);
    }

    const page = (await resp.json()) as StripeListResponse<StripeSession>;

    for (const session of page.data) {
      if (session.payment_status !== "paid") continue;
      const amt = session.amount_total ?? 0;
      collectedCents += amt;
      sessionCount++;

      if (session.created > latestTs) latestTs = session.created;
      if (session.created < genesisTs) {
        genesisTs    = session.created;
        genesisCents = amt;
      }
    }

    startingAfter = page.has_more && page.data.length > 0
      ? page.data[page.data.length - 1].id
      : undefined;
  } while (startingAfter);

  if (genesisTs === Number.MAX_SAFE_INTEGER) genesisTs = 0;

  const snapshotAt = new Date().toISOString();
  const payload    = JSON.stringify({ collectedCents, sessionCount, snapshotAt, kernelVersion: KERNEL_VERSION });
  const anchorSha  = await anchorPayload(payload);

  return {
    collectedCents,
    collectedDisplay: centsToDollars(collectedCents),
    sessionCount,
    latestSessionTs:  latestTs,
    genesisTs:        genesisTs === 0 ? 0 : genesisTs,
    genesisCents,
    snapshotAt,
    kernelVersion:    KERNEL_VERSION,
    anchorSha,
  };
}

// ── KaaS liability anchor ─────────────────────────────────────────────────────

export interface LiabilityAnchor {
  /** Total assessed liability in USD cents (from KaaS tier fees). */
  assessedCents:   number;
  assessedDisplay: string;
  /** Collected amount (from Stripe). */
  collectedCents:  number;
  collectedDisplay:string;
  /** Outstanding liability = assessed − collected. */
  outstandingCents:number;
  outstandingDisplay:string;
  /** Kernel SHA-512 anchor. */
  kernelSha:       string;
  kernelVersion:   string;
  snapshotAt:      string;
}

/**
 * Build a liability anchor combining Stripe-collected revenue with
 * the total assessed KaaS liability from D1.
 *
 * @param assessedCents  Total assessed liability (from kaas_valuations rows)
 * @param snapshot       Revenue snapshot from syncStripeRevenue()
 */
export function buildLiabilityAnchor(
  assessedCents: number,
  snapshot: RevenueSnapshot,
): LiabilityAnchor {
  const outstandingCents = Math.max(0, assessedCents - snapshot.collectedCents);
  return {
    assessedCents,
    assessedDisplay:    centsToDollars(assessedCents),
    collectedCents:     snapshot.collectedCents,
    collectedDisplay:   snapshot.collectedDisplay,
    outstandingCents,
    outstandingDisplay: centsToDollars(outstandingCents),
    kernelSha:          KERNEL_SHA,
    kernelVersion:      KERNEL_VERSION,
    snapshotAt:         snapshot.snapshotAt,
  };
}
