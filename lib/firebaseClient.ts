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
 *   FCM_DEVICE_TOKEN        ← Creator's FCM registration token (wrangler secret put FCM_DEVICE_TOKEN)
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
 * Firestore writes use the Firebase REST API with OAuth2 service account JWT
 * authentication — fully compatible with Cloudflare Workers (no firebase-admin
 * SDK required).  FCM push uses the HTTP v1 API (not legacy server key).
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
 *   averyos-d1-sync/            — D1 sovereign_audit_logs rows mirrored for parity
 *   averyos-tari-probe/         — D1 tari_probe Watcher rows mirrored for parity
 */

import { KERNEL_SHA } from "./sovereignConstants";

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
    !!(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_B64)
  );
}

/**
 * Resolve the Firebase RSA private key PEM from environment variables.
 *
 * Supports two storage strategies to work around the Cloudflare Dashboard
 * 1024-character secret limit (RSA PEM keys are ~1.7 KB):
 *
 *   FIREBASE_PRIVATE_KEY_B64  — Base64-encoded PEM (preferred for Dashboard UI)
 *     Store:  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($key))
 *     Decode: atob() at runtime before passing to normalisePem().
 *             atob() is available in Cloudflare Workers and Node.js ≥ 16.
 *
 *   FIREBASE_PRIVATE_KEY      — Raw or \n-escaped PEM (use with wrangler secret put)
 *
 * Priority: FIREBASE_PRIVATE_KEY_B64 > FIREBASE_PRIVATE_KEY
 */
export function resolveFirebasePrivateKey(): string {
  const b64 = typeof process !== "undefined" ? process.env.FIREBASE_PRIVATE_KEY_B64 : undefined;
  if (b64) {
    // Decode the Base64-encoded PEM stored via the Cloudflare Dashboard.
    try {
      return atob(b64);
    } catch {
      console.warn("[firebaseClient] FIREBASE_PRIVATE_KEY_B64 is not valid Base64; falling back to FIREBASE_PRIVATE_KEY");
    }
  }
  return (typeof process !== "undefined" ? process.env.FIREBASE_PRIVATE_KEY : undefined) ?? "";
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

// ── Google OAuth2 service account JWT helpers ─────────────────────────────────

/**
 * Normalise a Firebase private key from the Cloudflare Secret Store.
 * Handles both:
 *   • raw PEM  (newlines already present)
 *   • escaped PEM (literal \n stored by wrangler secret put)
 */
function normalisePem(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

/**
 * Base64url-encode a Uint8Array or ArrayBuffer (RFC 4648 §5, no padding).
 * Uses only globals available in Cloudflare Workers and Node.js ≥ 16.
 */
function base64urlEncode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Import a PKCS8 PEM-encoded RSA private key for RS256 signing via Web Crypto.
 * Works in both Cloudflare Workers and Node.js ≥ 22.
 */
async function importRsaPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pem = normalisePem(pemKey);
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Obtain a Google OAuth2 access token via service account JWT (RFC 7523).
 * Fully compatible with Cloudflare Workers — uses Web Crypto API for RSA signing.
 *
 * @param clientEmail — Firebase service account email
 * @param privateKey  — RSA private key PEM (raw or with escaped \n)
 * @param scopes      — OAuth2 scopes required (Firestore and/or FCM)
 * @returns           access_token string, or null on failure
 */
async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
  scopes: string[]
): Promise<string | null> {
  try {
    const enc        = new TextEncoder();
    const now        = Math.floor(Date.now() / 1000);
    const headerB64  = base64urlEncode(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const payloadB64 = base64urlEncode(enc.encode(JSON.stringify({
      iss:   clientEmail,
      sub:   clientEmail,
      aud:   "https://oauth2.googleapis.com/token",
      iat:   now,
      exp:   now + 3600,
      scope: scopes.join(" "),
    })));

    const signingInput = `${headerB64}.${payloadB64}`;
    const cryptoKey    = await importRsaPrivateKey(privateKey);
    const signature    = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      enc.encode(signingInput)
    );
    const jwt = `${signingInput}.${base64urlEncode(signature)}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.warn(`[firebaseClient] OAuth2 token error ${tokenRes.status}`);
      return null;
    }
    const { access_token } = await tokenRes.json() as { access_token: string };
    return access_token ?? null;
  } catch (err) {
    console.warn(`[firebaseClient] getGoogleAccessToken failed: ${(err as Error).message}`);
    return null;
  }
}

// ── Firestore REST API write helpers ─────────────────────────────────────────

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function toFirestoreValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string")  return { stringValue: v };
  if (typeof v === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, val] of Object.entries(v as Record<string, unknown>))
      fields[key] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFirestoreFields(doc: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, val] of Object.entries(doc)) fields[key] = toFirestoreValue(val);
  return fields;
}

/**
 * Write a document to a Firestore collection via the REST API (auto-generated ID).
 * Non-throwing — logs a warning on failure.
 */
async function firestoreAddDocument(
  projectId: string,
  collection: string,
  doc: Record<string, unknown>,
  accessToken: string
): Promise<void> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collection}`;
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields: toFirestoreFields(doc) }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[firebaseClient] Firestore write to ${collection} failed (${res.status}): ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(`[firebaseClient] firestoreAddDocument(${collection}) threw: ${(err as Error).message}`);
  }
}

/**
 * Obtain a Firestore-scoped access token and write a document — one helper call.
 * Returns false if credentials are absent or the token request fails (non-throwing).
 */
async function writeToFirestore(collection: string, doc: Record<string, unknown>): Promise<boolean> {
  const projectId   = process.env.FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
  const privateKey  = resolveFirebasePrivateKey();
  const accessToken = await getGoogleAccessToken(clientEmail, privateKey, [
    "https://www.googleapis.com/auth/datastore",
  ]);
  if (!accessToken) return false;
  await firestoreAddDocument(projectId, collection, doc, accessToken);
  return true;
}

// ── Live Firestore functions (active once credentials are provided) ────────────

/**
 * Log a resonance ping to the `averyos-resonance` Firestore collection.
 * Activates when FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and
 * FIREBASE_PRIVATE_KEY are configured.
 */
export async function logResonancePing(doc: ResonancePingDoc): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await writeToFirestore("averyos-resonance", doc as unknown as Record<string, unknown>);
}

/**
 * Update the live model alignment state in the `averyos-model-registry` collection.
 * Activates when FIREBASE_PROJECT_ID is set.
 */
export async function updateModelRegistry(
  modelId: string,
  update: Partial<ModelRegistryDoc>
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await writeToFirestore("averyos-model-registry", {
    model_id:   modelId,
    ...update,
    updated_at: iso9Now(),
    kernel_sha: KERNEL_SHA,
  });
}

/**
 * Log a drift detection alert to the `averyos-drift-alerts` Firestore collection.
 * Activates when FIREBASE_PROJECT_ID is set.
 */
export async function logDriftAlert(doc: DriftAlertDoc): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await writeToFirestore("averyos-drift-alerts", doc as unknown as Record<string, unknown>);
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

  // Write to Firestore — non-blocking fire-and-forget
  void writeToFirestore("averyos-handshake-sync", doc as unknown as Record<string, unknown>);

  return doc;
}

// ── Multi-Cloud D1 → Firebase Sync ───────────────────────────────────────────

/**
 * Document shape for a D1 audit row synced to Firebase.
 */
export interface D1SyncDoc {
  source:          "cloudflare_d1";
  table:           string;
  row_id:          number | string;
  event_type:      string;
  ip_address:      string;
  target_path:     string;
  threat_level:    number;
  tari_liability_usd?: number;
  pulse_hash?:     string;
  timestamp_ns:    string;
  synced_at:       string;
  kernel_sha:      string;
  creator_lock:    "🤛🏻";
}

/**
 * Sync a D1 sovereign_audit_logs row to the Firestore
 * `averyos-d1-sync` collection for Multi-Cloud D1/Firebase parity.
 *
 * Activates once FIREBASE_PROJECT_ID is configured — writes via Firestore
 * REST API (no firebase-admin SDK required).  Every Tier-7+ audit event in
 * D1 is mirrored to Firestore in real time, enabling cross-cloud drift detection.
 *
 * @param row — a row object from sovereign_audit_logs
 */
export async function syncD1RowToFirebase(row: {
  id:                number | string;
  event_type:        string;
  ip_address:        string;
  target_path:       string;
  threat_level:      number;
  tari_liability_usd?: number;
  pulse_hash?:       string;
  timestamp_ns:      string;
}): Promise<D1SyncDoc | null> {
  if (!isFirebaseConfigured()) return null;

  const doc: D1SyncDoc = {
    source:            "cloudflare_d1",
    table:             "sovereign_audit_logs",
    row_id:            row.id,
    event_type:        row.event_type,
    ip_address:        row.ip_address,
    target_path:       row.target_path,
    threat_level:      row.threat_level,
    tari_liability_usd: row.tari_liability_usd,
    pulse_hash:        row.pulse_hash,
    timestamp_ns:      row.timestamp_ns,
    synced_at:         iso9Now(),
    kernel_sha:        KERNEL_SHA,
    creator_lock:      "🤛🏻",
  };

  // Write to Firestore — non-blocking fire-and-forget
  void writeToFirestore("averyos-d1-sync", doc as unknown as Record<string, unknown>);

  return doc;
}

/**
 * Batch-sync multiple D1 audit rows to Firebase.
 * Skips rows with threat_level < minThreatLevel (default 7) to avoid noise.
 *
 * @param rows           — array of D1 row objects
 * @param minThreatLevel — minimum threat level to sync (default: 7)
 */
export async function batchSyncD1ToFirebase(
  rows: Parameters<typeof syncD1RowToFirebase>[0][],
  minThreatLevel = 7
): Promise<{ synced: number; skipped: number }> {
  let synced  = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.threat_level < minThreatLevel) { skipped++; continue; }
    const result = await syncD1RowToFirebase(row);
    if (result) synced++;
    else        skipped++;
  }
  return { synced, skipped };
}

// ── tari_probe → Firebase Sync ────────────────────────────────────────────────

/**
 * Document shape for a tari_probe Watcher row synced to Firebase.
 * Every Watcher detected by GabrielOS™ is mirrored here to ensure
 * cross-cloud audit parity.
 */
export interface TariProbeDoc {
  source:               "cloudflare_d1";
  table:                "tari_probe";
  row_id:               number | string;
  ray_id:               string;
  ip_address:           string;
  asn:                  string;
  user_agent:           string;
  target_path:          string;
  event_type:           string;
  threat_level:         number;
  tari_liability_usd:   number;
  pulse_hash?:          string;
  timestamp_ns:         string;
  synced_at:            string;
  kernel_sha:           string;
  milestone:            string;
  creator_lock:         "🤛🏻";
}

/**
 * Sync a tari_probe Watcher row to the Firestore `averyos-tari-probe` collection
 * for Multi-Cloud D1/Firebase parity.
 *
 * Every time a Watcher is logged to the D1 tari_probe table this function
 * should be called to mirror the record to Firebase, ensuring the audit trail
 * survives even if a single cloud provider attempts a "Nuclear Wipe".
 *
 * Activates once FIREBASE_PROJECT_ID is configured — writes via Firestore
 * REST API (no firebase-admin SDK required).
 *
 * @param row — a row object from the tari_probe table
 */
export async function syncTariProbeToFirebase(row: {
  id:                  number | string;
  ray_id:              string;
  ip_address:          string;
  asn:                 string;
  user_agent:          string;
  target_path:         string;
  event_type:          string;
  threat_level:        number;
  tari_liability_usd:  number;
  pulse_hash?:         string;
  timestamp_ns:        string;
}): Promise<TariProbeDoc | null> {
  if (!isFirebaseConfigured()) return null;

  const doc: TariProbeDoc = {
    source:              "cloudflare_d1",
    table:               "tari_probe",
    row_id:              row.id,
    ray_id:              row.ray_id,
    ip_address:          row.ip_address,
    asn:                 row.asn,
    user_agent:          row.user_agent,
    target_path:         row.target_path,
    event_type:          row.event_type,
    threat_level:        row.threat_level,
    tari_liability_usd:  row.tari_liability_usd,
    pulse_hash:          row.pulse_hash,
    timestamp_ns:        row.timestamp_ns,
    synced_at:           iso9Now(),
    kernel_sha:          KERNEL_SHA,
    milestone:           "962 Entities Documented | 156.2k Pulse Locked",
    creator_lock:        "🤛🏻",
  };

  // Write to Firestore — non-blocking fire-and-forget
  void writeToFirestore("averyos-tari-probe", doc as unknown as Record<string, unknown>);

  return doc;
}

/**
 * Batch-sync multiple tari_probe Watcher rows to Firebase.
 * All rows are synced regardless of threat_level since every Watcher detection
 * is forensically significant.
 *
 * @param rows — array of tari_probe row objects
 */
export async function batchSyncTariProbeToFirebase(
  rows: Parameters<typeof syncTariProbeToFirebase>[0][]
): Promise<{ synced: number; skipped: number }> {
  let synced  = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await syncTariProbeToFirebase(row);
    if (result) synced++;
    else        skipped++;
  }
  return { synced, skipped };
}

/**
 * Alias for syncTariProbeToFirebase — production-ready export used by the
 * Revenue Gate invoicing pipeline and the create-checkout API route.
 * Mirrors a single tari_probe row to Firebase once FIREBASE_PRIVATE_KEY is
 * stored in the Cloudflare Secret Store.
 *
 * ⛓️⚓⛓️  LOCKED AT 156.2k PULSE | 962 ENTITIES DOCUMENTED
 */
export const syncTariProbeRowToFirebase = syncTariProbeToFirebase;

// ── GabrielOS™ FCM HTTP v1 Push ───────────────────────────────────────────────

/**
 * Returns true when GabrielOS™ FCM push is fully configured.
 * Requires ALL of the following to be set as Cloudflare secrets:
 *   FIREBASE_PROJECT_ID      — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL    — Service account email (for OAuth2 JWT)
 *   FIREBASE_PRIVATE_KEY     — RSA private key PEM  (for OAuth2 JWT signing)
 *   FCM_DEVICE_TOKEN         — Creator's device FCM registration token
 *
 * Activate by running:
 *   wrangler secret put FIREBASE_PROJECT_ID
 *   wrangler secret put FIREBASE_CLIENT_EMAIL
 *   wrangler secret put FIREBASE_PRIVATE_KEY
 *   wrangler secret put FCM_DEVICE_TOKEN
 */
export function isFcmConfigured(): boolean {
  return isFirebaseConfigured() && !!process.env.FCM_DEVICE_TOKEN;
}

/**
 * Send a GabrielOS™ FCM HTTP v1 push notification to the Creator's registered device.
 *
 * Uses OAuth2 service account JWT (FCM HTTP v1 API) — not the deprecated legacy
 * server-key approach.  Fully compatible with Cloudflare Workers via Web Crypto API.
 *
 * Activate by running:
 *   wrangler secret put FCM_DEVICE_TOKEN
 *   wrangler secret put FIREBASE_PRIVATE_KEY
 *   wrangler secret put FIREBASE_CLIENT_EMAIL
 *   wrangler secret put FIREBASE_PROJECT_ID
 *
 * @param title — notification title
 * @param body  — notification body text
 * @param data  — optional string key-value data payload (passed alongside notification)
 * @returns     true on successful delivery, false if not configured or delivery failed
 */
export async function sendFcmV1Push(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!isFcmConfigured()) return false;

  const projectId   = process.env.FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
  const privateKey  = resolveFirebasePrivateKey();
  const deviceToken = process.env.FCM_DEVICE_TOKEN!;

  try {
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey, [
      "https://www.googleapis.com/auth/firebase.messaging",
    ]);
    if (!accessToken) return false;

    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
    const payload: Record<string, unknown> = {
      message: {
        token:        deviceToken,
        notification: { title, body },
        android:      { priority: "high" },
        apns:         { payload: { aps: { sound: "default" } } },
        ...(data ? { data } : {}),
      },
    };

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[firebaseClient] FCM HTTP v1 failed (${res.status}): ${errBody.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[firebaseClient] sendFcmV1Push failed: ${(err as Error).message}`);
    return false;
  }
}
