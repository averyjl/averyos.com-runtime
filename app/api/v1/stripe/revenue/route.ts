/**
 * GET /api/v1/stripe/revenue
 *
 * Stripe Revenue Sync endpoint — AveryOS™ Phase 105 GATE 105.4
 *
 * Fetches live settlement totals from the Stripe API and returns a
 * RevenueSnapshot + LiabilityAnchor for the Admin Monetization Dashboard.
 *
 * Auth: VaultGate HttpOnly cookie (`aos-vault-auth`).
 *
 * Query params:
 *   days   — Look-back window in days (default: 90, max: 365)
 *   probe  — If "1", returns 200 with empty body for cookie validation
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { VAULT_COOKIE_NAME } from "../../../../../lib/vaultCookieConfig";
import { syncStripeRevenue, buildLiabilityAnchor } from "../../../../../lib/stripe/syncRevenue";
import { formatIso9 } from "../../../../../lib/timePrecision";

interface CloudflareEnv {
  DB?:               D1Database;
  STRIPE_SECRET_KEY?: string;
  VAULT_PASSPHRASE?:  string;
}

interface D1Database {
  prepare(sql: string): { first<T>(): Promise<T | null> };
}

/** Extract vault token from HttpOnly cookie or x-vault-auth header. */
function extractToken(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const match  = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${VAULT_COOKIE_NAME}=`));
  if (match) return decodeURIComponent(match.slice(VAULT_COOKIE_NAME.length + 1));
  return request.headers.get("x-vault-auth") ?? "";
}

export async function GET(request: Request) {
  const url   = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";

  const token = extractToken(request);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const expected = cfEnv.VAULT_PASSPHRASE ?? "";
    if (!expected || token !== expected) {
      return aosErrorResponse(AOS_ERROR.UNAUTHORIZED, "VAULTAUTH_TOKEN required", 401);
    }

    // Cookie-probe shortcut
    if (probe) return Response.json({ status: "authenticated" });

    const stripeKey = cfEnv.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return aosErrorResponse(AOS_ERROR.VAULT_NOT_CONFIGURED, "STRIPE_SECRET_KEY is not configured", 503);
    }

    const days    = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") ?? "90", 10)));
    const revenue = await syncStripeRevenue(stripeKey, days);

    // Fetch total assessed KaaS liability from D1
    let assessedCents = 0;
    if (cfEnv.DB) {
      try {
        const row = await cfEnv.DB
          .prepare("SELECT COALESCE(SUM(CAST(valuation_usd AS REAL)), 0) AS total FROM kaas_valuations")
          .first<{ total: number }>();
        assessedCents = Math.round((row?.total ?? 0) * 100);
      } catch {
        // Non-fatal — liability anchor will show $0 assessed
      }
    }

    const liability = buildLiabilityAnchor(assessedCents, revenue);

    return Response.json(
      { revenue, liability, timestamp: formatIso9() },
      { headers: { "Cache-Control": "no-store, no-cache" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, `Revenue sync failed: ${msg}`, 502);
  }
}
