/**
 * POST /api/v1/tai/summit-handshake
 *
 * Stripe Summit Logging — Phase 98.5
 *
 * Records the Internal_Stripe_Handshake TAI™ accomplishment and returns a
 * cryptographic summit seal for presentation at the Stripe partnership meeting.
 *
 * Accepts an optional body with summit metadata:
 *   { meeting_date?, attendees?, notes?, ray_id? }
 *
 * Auth: Bearer VAULT_PASSPHRASE
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../../lib/taiAutoTracker";
import { safeEqual } from '../../../../../lib/taiLicenseGate';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Alias for the D1Database parameter expected by autoTrackAccomplishment(). */
type TaiD1 = Parameters<typeof autoTrackAccomplishment>[0];

interface CloudflareEnv {
  DB?:              D1Database;
  VAULT_PASSPHRASE?: string;
}

interface D1Database {
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown> } };
}

/** Constant-time string comparison. */
/** Compute a SHA-512 summit seal anchored to the kernel. */
async function computeSummitSeal(timestamp: string, meetingDate: string): Promise<string> {
  const input = `STRIPE_SUMMIT|${timestamp}|${meetingDate}|${KERNEL_SHA}`;
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth  = request.headers.get("authorization") ?? "";
  const token =
    auth.startsWith("Bearer ")    ? auth.slice(7).trim()  :
    auth.startsWith("Handshake ") ? auth.slice(10).trim() :
    (request.headers.get("x-vault-auth") ?? "");

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer token required.");
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional — proceed with defaults
  }

  const now         = formatIso9();
  const meetingDate = String(body.meeting_date ?? now);
  const attendees   = String(body.attendees    ?? "Jason Lee Avery + Stripe Partnership Team");
  const notes       = String(body.notes        ?? "AveryOS™ KaaS Infrastructure Summit — Phase 99 Clearinghouse Gate");
  const rayId       = String(body.ray_id       ?? "");

  // ── Compute summit seal ───────────────────────────────────────────────────
  const summitSeal = await computeSummitSeal(now, meetingDate);

  // ── Record TAI accomplishment ─────────────────────────────────────────────
  if (cfEnv.DB) {
    autoTrackAccomplishment(
      cfEnv.DB as unknown as TaiD1,
      {
        title:       "Internal_Stripe_Handshake",
        description:
          `AveryOS™ Stripe Summit handshake recorded. Meeting: ${meetingDate}. ` +
          `Attendees: ${attendees}. Notes: ${notes}. ` +
          `Summit Seal (SHA-512): ${summitSeal.slice(0, 32)}…. ` +
          `Kernel: ${KERNEL_VERSION} | cf83™ KaaS Clearinghouse Gate`,
        phase:    "Phase 98.5",
        category: "MILESTONE",
        ray_id:   rayId || undefined,
      }
    );
  }

  return Response.json({
    status:         "SUMMIT_HANDSHAKE_LOGGED",
    accomplishment: "Internal_Stripe_Handshake",
    phase:          "Phase 98.5",
    summit_seal:    summitSeal,
    meeting_date:   meetingDate,
    attendees,
    notes,
    logged_at:      now,
    kernel_sha:     KERNEL_SHA.slice(0, 16) + "…",
    kernel_version: KERNEL_VERSION,
    sovereign_anchor: "⛓️⚓⛓️",
    creator_lock:   "🤛🏻",
  });
}
