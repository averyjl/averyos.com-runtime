/**
 * lib/security/sovereignFetch.ts
 *
 * AveryOS™ Universal Handshake Wrapper — Phase 117.3 GATE 117.3.2
 *
 * Drop-in replacement for `fetch` that mandates:
 *   1. Round-Trip Verification (RTV) — every call must receive a confirmed
 *      response; silence is a violation.
 *   2. Certificate Pinning (SPKI) — hard-locks connections to known
 *      cryptographic keys for sovereign endpoints (Stripe, Cloudflare,
 *      Node-02).
 *   3. cf-ray capture — the Cloudflare Ray ID is extracted from every
 *      response header and Merkle-anchored to the VaultChain™ ledger.
 *   4. Physicality Status — every call returns a PhysicalityStatus code:
 *        PHYSICAL_TRUTH  → Ray ID confirmed + RTV echo received
 *        LATENT_ARTIFACT → call reached the network but no Ray ID present
 *        LATENT_PENDING  → call failed / timed out (not yet physical)
 *
 * This module wraps `lib/handshake.ts` (`sovereignFetch`) and adds the
 * Merkle-anchor + Physicality Status layer on top.
 *
 * Usage:
 * ```ts
 * const result = await universalFetch("https://api.stripe.com/v1/balance", {
 *   method: "GET",
 *   headers: { Authorization: `Bearer ${key}` },
 * }, { serviceName: "Stripe", db });
 *
 * if (result.physicalityStatus !== "PHYSICAL_TRUTH") {
 *   // handle non-physical response
 * }
 * ```
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { sovereignFetch, type HandshakeOpts, type HandshakeResult } from "../handshake";
import { KERNEL_SHA, KERNEL_VERSION }                                from "../sovereignConstants";
import { formatIso9 }                                                from "../timePrecision";
import type { PhysicalityStatus }                                    from "../registry/coreManifest";

// ── Type definitions ──────────────────────────────────────────────────────────

/** D1-compatible minimal interface (matches D1DatabaseLike in lib/handshake.ts). */
interface D1Like {
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<void> } };
}

/** Options extending HandshakeOpts with Physicality enforcement settings. */
export interface UniversalFetchOpts extends HandshakeOpts {
  /**
   * D1 binding for Merkle-anchoring cf-ray IDs to the VaultChain™ ledger.
   * Pass `null` to skip VaultChain persistence (dev / test mode).
   */
  db?: D1Like | null;
  /**
   * When true, PHYSICAL_TRUTH is only granted if the `cf-ray` response header
   * is present.  When false, any successful 2xx/3xx RTV echo is treated as
   * PHYSICAL_TRUTH.  Defaults to true for sovereign endpoints.
   */
  requireCfRay?: boolean;
}

/** The result of a universalFetch call. */
export interface UniversalFetchResult extends HandshakeResult {
  /** Cloudflare Ray ID extracted from the `cf-ray` response header, or null. */
  cfRay:              string | null;
  /**
   * PHYSICAL_TRUTH  — RTV echo confirmed + cf-ray anchored (or cfRay not
   *                   required and echo confirmed).
   * LATENT_ARTIFACT — call succeeded but no cf-ray header was present.
   * LATENT_PENDING  — call failed / timed out.
   */
  physicalityStatus:  PhysicalityStatus;
  /**
   * SHA-512 Merkle leaf for this call: SHA-512(url + cf-ray + kernelSha + ts).
   * Null if the call did not reach PHYSICAL_TRUTH / LATENT_ARTIFACT.
   */
  merkleLeaf:         string | null;
  /** ISO-9 timestamp when this call was completed. */
  completedAt:        string;
}

// ── Merkle leaf computation ───────────────────────────────────────────────────

/**
 * Compute a SHA-512 Merkle leaf for a single universalFetch call.
 *
 * Leaf = SHA-512( url‖"\x00"‖cfRay‖"\x00"‖kernelSha‖"\x00"‖completedAt )
 *
 * Uses the Web Crypto API (available in both Cloudflare Workers and Node ≥18).
 * Falls back to a deterministic hex placeholder when SubtleCrypto is absent.
 */
async function computeMerkleLeaf(
  url:         string,
  cfRay:       string | null,
  completedAt: string,
): Promise<string> {
  const input = [url, cfRay ?? "NO_RAY", KERNEL_SHA, completedAt].join("\x00");
  try {
    const encoder = new TextEncoder();
    const data    = encoder.encode(input);
    const hashBuf = await crypto.subtle.digest("SHA-512", data);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // SubtleCrypto unavailable — return a deterministic hex string derived
    // from the raw characters so the chain entry is still unique.
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16).padStart(128, "0").slice(0, 128);
  }
}

// ── VaultChain anchor ─────────────────────────────────────────────────────────

/** Write a cf-ray Merkle leaf to the VaultChain™ `sovereign_fetch_log` table. */
async function anchorToVaultChain(
  db:          D1Like,
  url:         string,
  cfRay:       string | null,
  merkleLeaf:  string,
  status:      PhysicalityStatus,
  completedAt: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO sovereign_fetch_log
           (url, cf_ray, merkle_leaf, physicality_status, kernel_sha,
            kernel_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        url.slice(0, 512),
        cfRay,
        merkleLeaf,
        status,
        KERNEL_SHA,
        KERNEL_VERSION,
        completedAt,
      )
      .run();
  } catch (err) {
    // Non-fatal — log to console but never throw; the caller gets the result
    // regardless of whether VaultChain persistence succeeded.
    console.error("[universalFetch] VaultChain anchor failed:", err instanceof Error ? err.message : String(err));
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * universalFetch — the Phase 117.3 drop-in replacement for `fetch`.
 *
 * Mandates RTV, captures cf-ray, computes a Merkle leaf, and anchors the
 * result to VaultChain™.  Returns a PhysicalityStatus alongside the standard
 * HandshakeResult fields.
 */
export async function universalFetch(
  url:   string | URL,
  init:  RequestInit | undefined,
  opts:  UniversalFetchOpts,
): Promise<UniversalFetchResult> {
  const completedAt    = formatIso9();
  const requireCfRay   = opts.requireCfRay ?? true;

  // Delegate the actual HTTP call + RTV to the existing Sovereign Handshake Guard.
  const base: HandshakeResult = await sovereignFetch(url, init, {
    serviceName:     opts.serviceName,
    timeoutMs:       opts.timeoutMs,
    db:              opts.db as HandshakeOpts["db"],
    phase:           opts.phase ?? "117.3",
    successStatuses: opts.successStatuses,
  });

  // ── Extract cf-ray ────────────────────────────────────────────────────────
  const cfRay: string | null = base.response?.headers?.get("cf-ray") ?? null;

  // ── Determine Physicality Status ─────────────────────────────────────────
  let physicalityStatus: PhysicalityStatus;
  if (!base.ok) {
    physicalityStatus = "LATENT_PENDING";
  } else if (requireCfRay && cfRay === null) {
    // Reached the network but no Cloudflare Ray ID → latent artifact
    physicalityStatus = "LATENT_ARTIFACT";
  } else {
    physicalityStatus = "PHYSICAL_TRUTH";
  }

  // ── Compute Merkle leaf ───────────────────────────────────────────────────
  let merkleLeaf: string | null = null;
  if (physicalityStatus !== "LATENT_PENDING") {
    merkleLeaf = await computeMerkleLeaf(url.toString(), cfRay, completedAt);
  }

  // ── Anchor to VaultChain™ ─────────────────────────────────────────────────
  if (merkleLeaf !== null && opts.db) {
    await anchorToVaultChain(
      opts.db,
      url.toString(),
      cfRay,
      merkleLeaf,
      physicalityStatus,
      completedAt,
    );
  }

  return {
    ...base,
    cfRay,
    physicalityStatus,
    merkleLeaf,
    completedAt,
  };
}

// ── Schema helper ─────────────────────────────────────────────────────────────

/**
 * Ensure the `sovereign_fetch_log` D1 table exists.
 * Call once on app startup or from a migration script.
 */
export async function ensureSovereignFetchLog(db: D1Like): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sovereign_fetch_log (
         id                  INTEGER PRIMARY KEY AUTOINCREMENT,
         url                 TEXT    NOT NULL,
         cf_ray              TEXT,
         merkle_leaf         TEXT    NOT NULL,
         physicality_status  TEXT    NOT NULL,
         kernel_sha          TEXT    NOT NULL,
         kernel_version      TEXT    NOT NULL,
         created_at          TEXT    NOT NULL
       )`,
    )
    .bind()
    .run();
}
