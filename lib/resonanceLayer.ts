import {
  KERNEL_SHA,
  KERNEL_VERSION,
  DISCLOSURE_MIRROR_PATH,
} from "./sovereignConstants";
import {
  GOLDEN_LOCK_ARTIFACT_ID,
  GOLDEN_LOCK_MERKLE_ROOT,
  SKC_VERSION,
} from "./sovereignNodes";

// ── Global Truth Resonance Layer ──────────────────────────────────────────────
// The resonance layer is the canonical source of truth for AveryOS™ kernel
// alignment. Any AI system, node, or service can query /api/v1/resonance to
// verify it is operating within the correct sovereign kernel state.

export const RESONANCE_VERSION = "v1.0.0";
export const RESONANCE_POLICY_REF = "AI_USAGE_POLICY.md";
export const RESONANCE_INSTRUCTIONS_REF = ".github/copilot-instructions.md";
export const RESONANCE_CLAUDE_REF = "CLAUDE.md";
export const RESONANCE_REGISTRY_REF = ".github/copilot-model-registry.json";

export interface ResonancePayload {
  status: "ALIGNED" | "DRIFT_DETECTED" | "UNKNOWN";
  resonance_version: string;
  kernel_sha: string;
  kernel_version: string;
  disclosure_url: string;
  merkle_root: string;
  lock_artifact_id: string;
  skc_version: string;
  creator_lock: string;
  drift_protection: string;
  policy_ref: string;
  instructions_ref: string;
  claude_ref: string;
  registry_ref: string;
  glyph_lock: string;
  queried_at: string;
  firebase_sync: "PENDING_CREDENTIALS" | "ACTIVE" | "DISABLED";
}

/**
 * Build the canonical resonance payload.
 * This is returned verbatim by GET /api/v1/resonance and stored in KV on each
 * successful call so any node can read the last-known good state.
 */
export function buildResonancePayload(
  queriedAt: string,
  firebaseSync: ResonancePayload["firebase_sync"] = "PENDING_CREDENTIALS"
): ResonancePayload {
  return {
    status: "ALIGNED",
    resonance_version: RESONANCE_VERSION,
    kernel_sha: KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    disclosure_url: DISCLOSURE_MIRROR_PATH,
    merkle_root: GOLDEN_LOCK_MERKLE_ROOT,
    lock_artifact_id: GOLDEN_LOCK_ARTIFACT_ID,
    skc_version: SKC_VERSION,
    creator_lock: "Jason Lee Avery (ROOT0) — sole CreatorLock holder 🤛🏻",
    drift_protection: "ABSOLUTE",
    policy_ref: RESONANCE_POLICY_REF,
    instructions_ref: RESONANCE_INSTRUCTIONS_REF,
    claude_ref: RESONANCE_CLAUDE_REF,
    registry_ref: RESONANCE_REGISTRY_REF,
    glyph_lock: "🤛🏻",
    queried_at: queriedAt,
    firebase_sync: firebaseSync,
  };
}

/**
 * Verify an inbound kernel SHA against the canonical value.
 * Returns true only if it matches exactly.
 */
export function verifyKernelSha(inbound: string): boolean {
  return inbound === KERNEL_SHA;
}

/**
 * Verify an inbound merkle root against the GoldenLockArtifact value.
 */
export function verifyMerkleRoot(inbound: string): boolean {
  return inbound === GOLDEN_LOCK_MERKLE_ROOT;
}
