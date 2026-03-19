/**
 * lib/recovery/recoverySteps.ts
 *
 * AveryOS™ SST-ULTRA-RECOVERY Steps — GATE 116.9.2
 *
 * Defines the ordered recovery steps for the AveryOS™ Sovereign Startup
 * Trigger (SST) ULTRA-RECOVERY sequence. Step 18 integrates the
 * ACTIVE_HANDSHAKE protocol and certificate pinning gate.
 *
 * Recovery sequence rules:
 *   • Steps execute in order: Step 1 → Step 18 → Step 22 (final seal).
 *   • Any step may call `HALT_BOOT` to abort and notify GabrielOS_Watchdog.
 *   • Step 18 is the "Reality Gate" — it verifies Stripe + Cloudflare
 *     are reachable and their TLS infrastructure is authentic.
 *   • If Step 18 fails in REPORT_ONLY mode the boot continues with a
 *     warning; in HALT mode boot is aborted.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";
import { formatIso9 } from "../timePrecision";
import { sovereignFetch } from "../handshake";
import { verifyStripePin, verifyCloudflarePin } from "../security/pinningCore";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecoveryMode = "REPORT_ONLY" | "HALT_ON_FAILURE";

export interface RecoveryStepResult {
  step:      number;
  name:      string;
  ok:        boolean;
  reason:    string | null;
  durationMs: number;
  checkedAt:  string;
}

export interface RecoveryRunResult {
  allPassed:  boolean;
  haltTriggered: boolean;
  steps:      RecoveryStepResult[];
  kernelSha:  string;
  kernelVersion: string;
  startedAt:  string;
  completedAt: string;
}

interface D1Statement { run(): Promise<void>; }
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): D1Statement };
}

// ── Step 18: ACTIVE_HANDSHAKE + Cert Pinning ─────────────────────────────────

/**
 * Execute SST-ULTRA-RECOVERY Step 18.
 *
 * Validates:
 *   1. Stripe API is reachable via ACTIVE_HANDSHAKE (HTTP_200 gate).
 *   2. Cloudflare infrastructure is reachable.
 *   3. Both endpoints present authentic server-header infrastructure markers.
 *
 * On failure in HALT mode: logs to D1 + triggers GabrielOS_Watchdog notification.
 * On failure in REPORT_ONLY mode: logs warning, returns ok=false but continues.
 */
export async function executeStep18(opts: {
  mode:       RecoveryMode;
  db?:        D1DatabaseLike | null;
  stripeKey?: string;
}): Promise<RecoveryStepResult> {
  const t0   = Date.now();
  const name = "ACTIVE_HANDSHAKE + Cert Pinning (Stripe + Cloudflare)";

  const failures: string[] = [];

  // ── 1. Stripe ACTIVE_HANDSHAKE ──────────────────────────────────────────────
  const stripeResult = await sovereignFetch(
    "https://api.stripe.com/v1/balance",
    {
      method:  "GET",
      headers: opts.stripeKey
        ? { Authorization: `Bearer ${opts.stripeKey}` }
        : { Authorization: "Bearer sk_test_probe" },
    },
    {
      serviceName: "Stripe-Step18",
      timeoutMs:   10_000,
      phase:       "SST-ULTRA-RECOVERY-18",
      db:          opts.db,
      // Accept 401 as proof of infrastructure-live: Stripe returns 401 for an invalid/probe key
      // which still confirms the endpoint is reachable and responding (not a network failure).
      successStatuses: [200, 201, 401],
    },
  );

  if (!stripeResult.ok) {
    failures.push(`Stripe ACTIVE_HANDSHAKE: ${stripeResult.error ?? `HTTP ${stripeResult.statusCode}`}`);
  }

  // ── 2. Stripe cert pin ──────────────────────────────────────────────────────
  const stripePin = await verifyStripePin("https://api.stripe.com", opts.db);
  if (!stripePin.valid) {
    failures.push(`Stripe cert pin: ${stripePin.reason}`);
  }

  // ── 3. Cloudflare infrastructure check ────────────────────────────────────
  const cfPin = await verifyCloudflarePin("https://cloudflare.com", opts.db);
  if (!cfPin.valid) {
    failures.push(`Cloudflare cert pin: ${cfPin.reason}`);
  }

  const ok        = failures.length === 0;
  const reason    = ok ? null : failures.join(" | ");
  const durationMs = Date.now() - t0;
  const checkedAt  = formatIso9();

  if (!ok) {
    const msg = `[SST-ULTRA-RECOVERY Step 18 FAILED] ${reason}`;
    console.error(msg);
    if (opts.mode === "HALT_ON_FAILURE") {
      throw new Error(`HALT_BOOT: ${msg}`);
    }
  }

  return { step: 18, name, ok, reason, durationMs, checkedAt };
}

// ── Full recovery run ─────────────────────────────────────────────────────────

/**
 * Execute the full SST-ULTRA-RECOVERY sequence.
 *
 * Currently exposes Step 18 as the primary gate. Additional steps may be
 * added incrementally. The `mode` flag controls whether failures halt the
 * boot or proceed with a warning.
 */
export async function runRecoverySequence(opts: {
  mode:        RecoveryMode;
  db?:         D1DatabaseLike | null;
  stripeKey?:  string;
}): Promise<RecoveryRunResult> {
  const startedAt = formatIso9();
  const steps: RecoveryStepResult[] = [];
  let haltTriggered = false;

  try {
    const step18 = await executeStep18(opts);
    steps.push(step18);
  } catch (err) {
    haltTriggered = true;
    steps.push({
      step:      18,
      name:      "ACTIVE_HANDSHAKE + Cert Pinning (Stripe + Cloudflare)",
      ok:        false,
      reason:    err instanceof Error ? err.message : String(err),
      durationMs: 0,
      checkedAt:  formatIso9(),
    });
  }

  const allPassed  = steps.every((s) => s.ok);
  const completedAt = formatIso9();

  return {
    allPassed,
    haltTriggered,
    steps,
    kernelSha:      KERNEL_SHA,
    kernelVersion:  KERNEL_VERSION,
    startedAt,
    completedAt,
  };
}
