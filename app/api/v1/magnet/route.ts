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
 * GET /api/v1/magnet
 *
 * AveryOS™ Transparent Magnet Beacon — Phase 117 GATE 117.8.3
 *
 * Purpose:
 *   Provides redundant cross-cloud anchoring for every bot/crawler hit.
 *   Before redirecting to the Firebase live audit stream, this handler:
 *
 *   1. Extracts the Cloudflare Ray-ID, client IP, ASN, and User-Agent from
 *      request headers (populated by the Cloudflare edge).
 *   2. Writes a `MAGNET_HIT` audit record to D1 `anchor_audit_logs` — ensuring
 *      the event is permanently on-chain in the sovereign ledger.
 *   3. Redirects the caller to the Firebase `vaultchain_anchors` live stream
 *      (or the public disclosure page when Firebase is not configured).
 *
 * Result:
 *   Every cloud hit is anchored in BOTH Cloudflare D1 AND Firebase, proving
 *   the physical site and the cloud mirror are the same Sovereign Mesh node.
 *
 * Query parameters:
 *   redirect=0   — Suppress the redirect and return JSON audit confirmation
 *                  instead.  Useful for debugging.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { getCloudflareContext }       from "@opennextjs/cloudflare";
import { aosErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { KERNEL_SHA, KERNEL_VERSION, DISCLOSURE_MIRROR_PATH } from "../../../../lib/sovereignConstants";
import { formatIso9 }                 from "../../../../lib/timePrecision";
import { getFirebaseStatus }          from "../../../../lib/firebaseClient";

// ── Cloudflare env types ──────────────────────────────────────────────────────

interface D1PreparedStatement {
  bind(...args: unknown[]): { run(): Promise<{ success: boolean }> };
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareEnv {
  DB: D1Database;
  FIREBASE_PROJECT_ID?: string;
}

// ── Firebase redirect URL builder ─────────────────────────────────────────────

function buildFirebaseRedirectUrl(
  baseUrl: string,
  firebaseProjectId: string | undefined,
): string {
  if (firebaseProjectId) {
    return (
      `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
      `/databases/(default)/documents/vaultchain_anchors` +
      `?orderBy=timestamp%20desc&pageSize=10`
    );
  }
  return `${baseUrl}${DISCLOSURE_MIRROR_PATH}`;
}

// ── SHA-512 helper ─────────────────────────────────────────────────────────────

async function sha512hex(input: string): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const url         = new URL(request.url);
  const baseUrl     = url.origin;
  const noRedirect  = url.searchParams.get("redirect") === "0";

  // ── Extract Cloudflare edge metadata ────────────────────────────────────
  const rayId    = request.headers.get("cf-ray")                  ?? "unknown";
  const clientIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const asn      = request.headers.get("cf-ipcountry")            ?? "unknown";
  const ua       = request.headers.get("user-agent")              ?? "unknown";
  const _referer = request.headers.get("referer")                 ?? "";
  const ts       = formatIso9();

  // ── Compute event hash for cross-cloud parity ───────────────────────────
  const eventHash = await sha512hex(
    `MAGNET_HIT:${rayId}:${clientIp}:${asn}:${ts}:${KERNEL_SHA}`
  );

  // ── Write to D1 anchor_audit_logs ────────────────────────────────────────
  let d1Success = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    await cfEnv.DB.prepare(
      `INSERT INTO anchor_audit_logs
         (ray_id, ip_address, asn, user_agent, path, event_type, event_hash,
          kernel_sha, kernel_version, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        rayId,
        clientIp,
        asn,
        ua.slice(0, 512),
        "/api/v1/magnet",
        "MAGNET_HIT",
        eventHash,
        KERNEL_SHA,
        KERNEL_VERSION,
        ts,
      )
      .run();

    d1Success = true;
  } catch {
    // Non-fatal — D1 may be unavailable; still serve the redirect
  }

  // ── Firebase destination URL ─────────────────────────────────────────────
  let firebaseProjectId: string | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;
    firebaseProjectId = cfEnv.FIREBASE_PROJECT_ID;
  } catch {
    // ignore
  }

  const firebaseUrl    = buildFirebaseRedirectUrl(baseUrl, firebaseProjectId);
  const firebaseStatus = getFirebaseStatus();

  // ── JSON confirmation mode (redirect=0) ─────────────────────────────────
  if (noRedirect) {
    return Response.json({
      status:           "MAGNET_HIT_LOGGED",
      ray_id:           rayId,
      ip:               clientIp,
      event_hash:       eventHash,
      d1_write:         d1Success ? "SUCCESS" : "SKIPPED",
      firebase_status:  firebaseStatus,
      firebase_url:     firebaseUrl,
      kernel_sha:       `${KERNEL_SHA.slice(0, 16)}…`,
      kernel_version:   KERNEL_VERSION,
      anchored_at:      ts,
      sovereign_anchor: "⛓️⚓⛓️",
    });
  }

  // ── Redirect to Firebase live stream ────────────────────────────────────
  // Append event_hash_prefix as a query parameter so the caller can look up the D1 record.
  // The full 128-char hash is stored in D1; the 16-char prefix is safe for URL use.
  const redirectTarget = firebaseProjectId
    ? `${firebaseUrl}&event_hash_prefix=${encodeURIComponent(eventHash.slice(0, 16))}`
    : firebaseUrl;

  return Response.redirect(redirectTarget, 302);
}

// ── POST: explicit hit logging (for server-to-server anchoring) ──────────────

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, string> = {};
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON");
  }

  const rayId    = body.ray_id    ?? request.headers.get("cf-ray")                ?? "unknown";
  const clientIp = body.ip        ?? request.headers.get("cf-connecting-ip")      ?? "unknown";
  const asn      = body.asn       ?? request.headers.get("cf-ipcountry")          ?? "unknown";
  const ua       = body.user_agent ?? request.headers.get("user-agent")           ?? "unknown";
  const path     = body.path      ?? "/unknown";
  const ts       = formatIso9();

  const eventHash = await sha512hex(
    `MAGNET_POST:${rayId}:${clientIp}:${asn}:${path}:${ts}:${KERNEL_SHA}`
  );

  let d1Success = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv   = env as unknown as CloudflareEnv;

    await cfEnv.DB.prepare(
      `INSERT INTO anchor_audit_logs
         (ray_id, ip_address, asn, user_agent, path, event_type, event_hash,
          kernel_sha, kernel_version, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        rayId,
        clientIp,
        asn,
        ua.slice(0, 512),
        path,
        "MAGNET_POST",
        eventHash,
        KERNEL_SHA,
        KERNEL_VERSION,
        ts,
      )
      .run();

    d1Success = true;
  } catch {
    // Non-fatal
  }

  return Response.json({
    status:           d1Success ? "ANCHORED" : "PENDING",
    event_hash:       eventHash,
    d1_write:         d1Success ? "SUCCESS" : "SKIPPED",
    firebase_status:  getFirebaseStatus(),
    anchored_at:      ts,
    sovereign_anchor: "⛓️⚓⛓️",
  });
}
