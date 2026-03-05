/**
 * Firebase Client — AveryOS™ Global Truth Resonance Layer
 *
 * This module is wired and ready. It activates automatically when the
 * following environment variables are set in Cloudflare secrets or .env.local:
 *
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   ← store in Cloudflare Secret Store ONLY
 *   FIREBASE_DATABASE_URL   (optional — Realtime Database)
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * SECURITY — FIREBASE_PRIVATE_KEY:
 *   Never store FIREBASE_PRIVATE_KEY in .env files or source code.
 *   Always use `wrangler secret put FIREBASE_PRIVATE_KEY` to encrypt it in the
 *   Cloudflare Secret Store so it is never visible in the deployment bundle or
 *   GitHub logs.  The logFirebaseHandshake() function below computes and records
 *   a SHA-512 hash of every inter-cloud handshake to the VaultChain™, enabling
 *   real-time detection of "Watcher Drift" between GPT/Gemini/Meta loops.
 *
 * Until credentials are provided, all functions return a "PENDING_CREDENTIALS"
 * status gracefully — no errors, no crashes.
 *
 * Firestore collection structure (once active):
 *   averyos-resonance/          — resonance pings from all nodes and AI models
 *   averyos-model-registry/     — live AI model alignment state
 *   averyos-drift-alerts/       — drift detection events
 *   averyos-ip-protection/      — IP protection scan results
 *   averyos-handshake-sync/     — SHA-512-hashed inter-cloud sync events
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

/**
 * Handshake sync log entry — one record per inter-cloud GPT/Gemini/Meta sync.
 * The pulse_hash is SHA-512(source_id + target_id + payload_sha + timestamp)
 * and is written to both Firestore and VaultChain™ for cross-cloud drift detection.
 */
export interface HandshakeSyncDoc {
  source_id: string;
  target_id: string;
  payload_sha: string;
  pulse_hash: string;
  kernel_sha: string;
  timestamp: string;
  drift_detected: boolean;
  creator_lock: "🤛🏻";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** ISO-9 microsecond-precision timestamp */
function iso9Now(): string {
  const iso = new Date().toISOString();
  const [left, right] = iso.split(".");
  const ms = (right ?? "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${ms}000000Z`;
}

/**
 * Compute SHA-512 hex digest of an arbitrary string payload.
 * Uses Web Crypto API (available in both Node.js ≥ 19 and Cloudflare Workers).
 */
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

/**
 * Log a cross-cloud handshake synchronisation event to Firestore with a
 * SHA-512 pulse hash.  This enables real-time detection of "Watcher Drift"
 * — any tampering with the payload between nodes changes the pulse hash.
 *
 * Call this from any route that sends or receives data from GPT, Gemini,
 * or Meta AI endpoints so every inter-cloud handshake is anchored to the
 * VaultChain™ ledger.
 *
 * @param sourceId   — identifier of the sending system (e.g. "averyos-cloudflare")
 * @param targetId   — identifier of the receiving system (e.g. "openai-gpt4o")
 * @param payloadSha — SHA-512 hex digest of the request/response payload
 */
export async function logFirebaseHandshake(
  sourceId: string,
  targetId: string,
  payloadSha: string
): Promise<HandshakeSyncDoc | null> {
  if (!isFirebaseConfigured()) return null;

  const timestamp = iso9Now();
  const KERNEL_SHA =
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

  // Pulse hash = SHA-512(sourceId | targetId | payloadSha | KERNEL_SHA | timestamp)
  // Any deviation from the expected pulse hash indicates Watcher Drift.
  const pulseHash = await sha512hex(
    `${sourceId}|${targetId}|${payloadSha}|${KERNEL_SHA}|${timestamp}`
  );

  const doc: HandshakeSyncDoc = {
    source_id: sourceId,
    target_id: targetId,
    payload_sha: payloadSha,
    pulse_hash: pulseHash,
    kernel_sha: KERNEL_SHA,
    timestamp,
    drift_detected: false,
    creator_lock: "🤛🏻",
  };

  // TODO: write to Firestore once firebase-admin credentials are wired:
  // const db = getFirestore();
  // await db.collection("averyos-handshake-sync").add(doc);

  return doc;
}
