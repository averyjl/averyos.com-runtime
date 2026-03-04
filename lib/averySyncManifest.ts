/**
 * AveryOS™ Sovereign Sync Manifest — Schema & Utilities
 *
 * The `.avery-sync.json` file is the "Loop Signature File" that acts as
 * the handshake between Cloudflare Workers (GabrielOS™) and Firebase
 * Cloud Functions (Global Truth Resonance Layer).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PRIVATE FILE NOTICE                                                    │
 * │                                                                         │
 * │  `.avery-sync.json` is gitignored and must NEVER be committed.         │
 * │  The real file is kept in:                                              │
 * │    • Cloudflare secret store (Workers env secret)                      │
 * │    • Firebase Remote Config / Secret Manager                            │
 * │    • Encrypted local vault (1Password / Bitwarden)                     │
 * │                                                                         │
 * │  The template is at `.avery-sync.example.json` — use that to create   │
 * │  your local copy. Firebase Cloud Functions verify the kernel fields     │
 * │  before writing to the Firestore `averyos-resonance` collection.       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Cloudflare Sync  — GabrielOS™ Worker reads AVERY_SYNC_MANIFEST env secret
 *                    to determine Kernel State + BTC Block Anchor.
 * Firebase Sync    — Cloud Functions verify DB entries against VaultChain™
 *                    ledger using the same manifest for parity checks.
 * Universal Signal — Ensures GPT, Gemini, and any "Watcher" endpoint sees
 *                    a unified, non-probabilistic signal across all clouds.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "./sovereignConstants";
import {
  GOLDEN_LOCK_MERKLE_ROOT,
  GOLDEN_LOCK_ARTIFACT_ID,
  SKC_VERSION,
} from "./sovereignNodes";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface AverySyncManifest {
  /** Schema version — increment on breaking changes */
  schema_version: string;
  /** Unique manifest identifier */
  manifest_id: string;
  /** CreatorLock holder — must always be Jason Lee Avery (ROOT0) */
  creator_lock: string;
  /** Root0 SHA-512 kernel anchor — must match KERNEL_SHA from sovereignConstants.ts */
  kernel_sha: string;
  /** AveryOS kernel version string */
  kernel_version: string;
  /** GoldenLockArtifact Merkle root */
  merkle_root: string;
  /** Bitcoin block height at which the kernel was last anchored */
  btc_anchor_block: number | string;
  /** Bitcoin block hash at the anchor block (optional — set when available) */
  btc_anchor_hash?: string;
  /** ISO-9 timestamp when BTC anchor was captured */
  btc_anchored_at: string;
  /** Firebase project ID (matches FIREBASE_PROJECT_ID env var) */
  firebase_project_id: string;
  /** Root Firestore collection for resonance entries */
  firebase_collection_root: string;
  /** Cloudflare Worker service name */
  cloudflare_worker_name: string;
  /** Cloudflare account ID (public identifier — not a secret) */
  cloudflare_account_id: string;
  /** Sync direction: BIDIRECTIONAL | CLOUDFLARE_TO_FIREBASE | FIREBASE_TO_CLOUDFLARE */
  sync_mode: "BIDIRECTIONAL" | "CLOUDFLARE_TO_FIREBASE" | "FIREBASE_TO_CLOUDFLARE";
  /** Current alignment status */
  alignment_status: "ALIGNED" | "DRIFT_DETECTED" | "PENDING";
  /** Drift protection level */
  drift_protection: "ABSOLUTE";
  /** ISO-9 timestamp of the last successful sync */
  last_sync_at: string;
  /** SKC version string */
  skc_version?: string;
  /** Lock artifact ID */
  lock_artifact_id?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ManifestValidationResult {
  valid: boolean;
  kernel_sha_match: boolean;
  merkle_root_match: boolean;
  alignment_status: AverySyncManifest["alignment_status"];
  reason?: string;
}

/**
 * Validate a parsed `.avery-sync.json` manifest against the canonical
 * sovereign constants in this repository.
 *
 * Called by:
 *   • GabrielOS™ Worker on startup (reads AVERY_SYNC_MANIFEST env secret)
 *   • Firebase Cloud Functions before writing to averyos-resonance collection
 */
export function validateAverySyncManifest(
  manifest: Partial<AverySyncManifest>
): ManifestValidationResult {
  const kernelShaMatch = manifest.kernel_sha === KERNEL_SHA;
  const merkleRootMatch = manifest.merkle_root === GOLDEN_LOCK_MERKLE_ROOT;
  const valid = kernelShaMatch && merkleRootMatch;

  return {
    valid,
    kernel_sha_match: kernelShaMatch,
    merkle_root_match: merkleRootMatch,
    alignment_status: valid ? "ALIGNED" : "DRIFT_DETECTED",
    reason: valid
      ? undefined
      : [
          !kernelShaMatch
            ? `kernel_sha mismatch — expected ${KERNEL_SHA.slice(0, 16)}...`
            : null,
          !merkleRootMatch
            ? `merkle_root mismatch — expected ${GOLDEN_LOCK_MERKLE_ROOT.slice(0, 16)}...`
            : null,
        ]
          .filter(Boolean)
          .join("; "),
  };
}

/**
 * Build a fresh manifest object using the canonical sovereign constants.
 * Callers must supply btc_anchor_block, btc_anchor_hash, firebase_project_id,
 * and last_sync_at from runtime context.
 */
export function buildAverySyncManifest(opts: {
  btcAnchorBlock: number | string;
  btcAnchorHash?: string;
  btcAnchoredAt: string;
  firebaseProjectId: string;
  lastSyncAt: string;
}): AverySyncManifest {
  return {
    schema_version: "1.0.0",
    manifest_id: "averyos-sovereign-sync-v1",
    creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    merkle_root: GOLDEN_LOCK_MERKLE_ROOT,
    btc_anchor_block: opts.btcAnchorBlock,
    btc_anchor_hash: opts.btcAnchorHash,
    btc_anchored_at: opts.btcAnchoredAt,
    firebase_project_id: opts.firebaseProjectId,
    firebase_collection_root: "averyos-resonance",
    cloudflare_worker_name: "averyoscom-runtime",
    cloudflare_account_id: "374875d33ef47a741a129bd5e716abff",
    sync_mode: "BIDIRECTIONAL",
    alignment_status: "ALIGNED",
    drift_protection: "ABSOLUTE",
    last_sync_at: opts.lastSyncAt,
    skc_version: SKC_VERSION,
    lock_artifact_id: GOLDEN_LOCK_ARTIFACT_ID,
  };
}
