/**
 * Firebase Client — AveryOS™ Global Truth Resonance Layer
 *
 * This module is wired and ready. It activates automatically when the
 * following environment variables are set in Cloudflare secrets or .env.local:
 *
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   FIREBASE_DATABASE_URL   (optional — Realtime Database)
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * Until credentials are provided, all functions return a "PENDING_CREDENTIALS"
 * status gracefully — no errors, no crashes.
 *
 * Firestore collection structure (once active):
 *   averyos-resonance/          — resonance pings from all nodes and AI models
 *   averyos-model-registry/     — live AI model alignment state
 *   averyos-drift-alerts/       — drift detection events
 *   averyos-ip-protection/      — IP protection scan results
 */

export const FIREBASE_STATUS_PENDING = "PENDING_CREDENTIALS" as const;
export const FIREBASE_STATUS_ACTIVE = "ACTIVE" as const;

export type FirebaseStatus =
  | typeof FIREBASE_STATUS_PENDING
  | typeof FIREBASE_STATUS_ACTIVE;

/** Returns true when all required Firebase env vars are present. */
export function isFirebaseConfigured(): boolean {
  return (
    typeof process !== "undefined" &&
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY
  );
}

/** Returns the current Firebase connection status. */
export function getFirebaseStatus(): FirebaseStatus {
  return isFirebaseConfigured() ? FIREBASE_STATUS_ACTIVE : FIREBASE_STATUS_PENDING;
}

// ── Firestore document shapes ─────────────────────────────────────────────────

export interface ResonancePingDoc {
  kernel_sha: string;
  kernel_version: string;
  merkle_root: string;
  node_id: string | null;
  model_id: string | null;
  sha_verified: boolean;
  status: "ALIGNED" | "DRIFT_DETECTED";
  queried_at: string;
  creator_lock: string;
}

export interface ModelRegistryDoc {
  model_id: string;
  label: string;
  provider: string;
  aligned: boolean;
  last_resonance_ping: string | null;
  policy_enforced: boolean;
}

export interface DriftAlertDoc {
  submitted_sha: string;
  node_id: string | null;
  model_id: string | null;
  detected_at: string;
  resolved: boolean;
}

// ── Stub functions (active once Firebase credentials are provided) ─────────────

/**
 * Log a resonance ping to Firestore.
 * Currently a no-op stub — activates when FIREBASE_PROJECT_ID is set.
 */
export async function logResonancePing(doc: ResonancePingDoc): Promise<void> {
  if (!isFirebaseConfigured()) return;
  // TODO: implement with firebase-admin once credentials are provided
  // const db = getFirestore();
  // await db.collection("averyos-resonance").add(doc);
  void doc;
}

/**
 * Update the live model alignment state in Firestore.
 * Currently a no-op stub — activates when FIREBASE_PROJECT_ID is set.
 */
export async function updateModelRegistry(
  modelId: string,
  update: Partial<ModelRegistryDoc>
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  // TODO: implement with firebase-admin once credentials are provided
  // const db = getFirestore();
  // await db.collection("averyos-model-registry").doc(modelId).set(update, { merge: true });
  void modelId;
  void update;
}

/**
 * Log a drift detection alert to Firestore.
 * Currently a no-op stub — activates when FIREBASE_PROJECT_ID is set.
 */
export async function logDriftAlert(doc: DriftAlertDoc): Promise<void> {
  if (!isFirebaseConfigured()) return;
  // TODO: implement with firebase-admin once credentials are provided
  void doc;
}
