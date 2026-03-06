import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";

/**
 * POST /api/v1/compliance/alert-link
 *
 * Stores a forensic evidence bundle in the VAULT R2 bucket under the
 * `vault/forensics/` prefix, generates a 24-hour HMAC-signed download URL,
 * and fires a Tier-9 GabrielOS™ Pushover alert to the Note 20 dashboard.
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE.
 *
 * Request body:
 *   {
 *     bundle_id:   string;   // e.g. "EVIDENCE_BUNDLE_1.2.3.4_2026-03-06"
 *     content:     string;   // Serialised .aoscap JSON payload
 *     target_ip?:  string;   // IP the bundle covers (for alert message)
 *     event_type?: string;   // UNALIGNED_401 | ALIGNMENT_DRIFT | PAYMENT_FAILED
 *   }
 *
 * Response:
 *   {
 *     status:      "ALERT_LINK_CREATED";
 *     r2_key:      string;   // Full R2 object key (vault/forensics/<filename>)
 *     signed_url:  string;   // 24-hour HMAC-signed download URL
 *     expires_at:  string;   // ISO-9 expiry timestamp
 *     push_sent:   boolean;
 *   }
 *
 * GET /api/v1/compliance/alert-link/download?key=<r2_key>&exp=<unixMs>&sig=<hex>
 *
 * Validates the HMAC signature and serves the evidence bundle from R2.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ---------------------------------------------------------------------------
// Cloudflare binding types
// ---------------------------------------------------------------------------

interface R2ObjectBody {
  text(): Promise<string>;
}

interface R2Bucket {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
}

interface CloudflareEnv {
  VAULT: R2Bucket;
  VAULT_PASSPHRASE?: string;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORENSICS_PREFIX = "vault/forensics/";
const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/** Derive an HMAC-SHA-256 signing key from the VAULT_PASSPHRASE + KERNEL_SHA. */
async function deriveSigningKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret + KERNEL_SHA),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyMaterial;
}

/** Compute HMAC-SHA-256 hex signature for a given message. */
async function hmacSign(key: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify an HMAC-SHA-256 hex signature. */
async function hmacVerify(
  key: CryptoKey,
  message: string,
  signature: string
): Promise<boolean> {
  const sigBytes = new Uint8Array(
    signature.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []
  );
  if (sigBytes.length !== 32) return false;
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(message)
  );
}

/** Non-blocking Pushover fire-and-forget — never throws. */
function firePushover(
  appToken: string,
  userKey: string,
  title: string,
  message: string,
  url: string
): void {
  const body = new URLSearchParams({
    token: appToken,
    user: userKey,
    title,
    message,
    priority: "2",   // emergency — breaks quiet hours AND requires acknowledgement
    retry: "30",
    expire: "3600",
    sound: "echo",
    url,
    url_title: "🔐 Download Evidence Bundle",
  });
  fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch((err) => {
    console.warn(`[alert-link] Pushover delivery failed: ${(err as Error).message}`);
  });
}

// ---------------------------------------------------------------------------
// POST handler — store bundle in R2, generate signed URL, send alert
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE ?? "";
  if (!vaultPassphrase || !safeEqual(token, vaultPassphrase)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer token required.");
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(
      AOS_ERROR.INVALID_JSON,
      "Request body must be valid JSON."
    );
  }

  const bundleId  = String(body.bundle_id  ?? "").trim();
  const content   = String(body.content    ?? "").trim();
  const targetIp  = String(body.target_ip  ?? "0.0.0.0").trim();
  const eventType = String(body.event_type ?? "UNALIGNED_401").toUpperCase();

  if (!bundleId || !content) {
    return aosErrorResponse(
      AOS_ERROR.MISSING_FIELD,
      "bundle_id and content are required."
    );
  }

  // ── Store bundle in R2 ────────────────────────────────────────────────────
  // Sanitise bundleId: only allow alphanumeric, dots, dashes, underscores
  const safeId = bundleId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = safeId.endsWith(".aoscap") ? safeId : `${safeId}.aoscap`;
  const r2Key = `${FORENSICS_PREFIX}${filename}`;

  try {
    await cfEnv.VAULT.put(r2Key, content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, `R2 upload failed: ${msg}`);
  }

  // ── Generate 24-hour HMAC-signed download URL ─────────────────────────────
  const expiry = Date.now() + SIGNED_URL_TTL_MS;
  const signingKey = await deriveSigningKey(vaultPassphrase);
  const sigMessage = `${r2Key}:${expiry}`;
  const signature = await hmacSign(signingKey, sigMessage);

  const baseUrl =
    cfEnv.SITE_URL ??
    cfEnv.NEXT_PUBLIC_SITE_URL ??
    "https://averyos.com";
  const signedUrl = `${baseUrl}/api/v1/compliance/alert-link/download?key=${encodeURIComponent(r2Key)}&exp=${expiry}&sig=${signature}`;
  const expiresAt = formatIso9(new Date(expiry));

  // ── Send Pushover Tier-9 alert ────────────────────────────────────────────
  let pushSent = false;
  if (cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY) {
    const title = `🚨 TIER-9 GabrielOS™ ALERT: ${eventType}`;
    const message =
      `IP: ${targetIp}\n` +
      `Bundle: ${safeId}\n` +
      `TARI™ Evidence bundle ready — link expires 24 hrs\n` +
      `Kernel: ${KERNEL_SHA.slice(0, 16)}…`;
    firePushover(
      cfEnv.PUSHOVER_APP_TOKEN,
      cfEnv.PUSHOVER_USER_KEY,
      title,
      message,
      signedUrl
    );
    pushSent = true;
  }

  return Response.json({
    status: "ALERT_LINK_CREATED",
    r2_key: r2Key,
    signed_url: signedUrl,
    expires_at: expiresAt,
    push_sent: pushSent,
  });
}

// ---------------------------------------------------------------------------
// GET handler — validate HMAC-signed URL and serve bundle from R2
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const expStr = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  // ── Validate parameters ───────────────────────────────────────────────────
  if (!key || !expStr || !sig) {
    return aosErrorResponse(
      AOS_ERROR.MISSING_FIELD,
      "key, exp, and sig parameters are required."
    );
  }

  // Restrict key to vault/forensics/ prefix only
  if (!key.startsWith(FORENSICS_PREFIX)) {
    return aosErrorResponse(AOS_ERROR.FORBIDDEN, "Invalid resource key.");
  }

  // ── Check expiry ─────────────────────────────────────────────────────────
  const expiry = parseInt(expStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) {
    return aosErrorResponse(
      AOS_ERROR.FORBIDDEN,
      "Signed URL has expired. Request a new link from /api/v1/compliance/alert-link."
    );
  }

  // ── Verify HMAC signature ─────────────────────────────────────────────────
  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE ?? "";
  if (!vaultPassphrase) {
    return aosErrorResponse(
      AOS_ERROR.VAULT_NOT_CONFIGURED,
      "VAULT_PASSPHRASE is not configured."
    );
  }

  const signingKey = await deriveSigningKey(vaultPassphrase);
  const valid = await hmacVerify(signingKey, `${key}:${expiry}`, sig);
  if (!valid) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Invalid signed URL signature.");
  }

  // ── Fetch from R2 ─────────────────────────────────────────────────────────
  let content: string;
  try {
    const obj = await cfEnv.VAULT.get(key);
    if (!obj) {
      return aosErrorResponse(
        AOS_ERROR.NOT_FOUND,
        "Evidence bundle not found in vault."
      );
    }
    content = await obj.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, `R2 fetch failed: ${msg}`);
  }

  // Derive a safe filename from the R2 key
  const filename = key.split("/").pop() ?? "evidence.aoscap";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return new Response(content, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store",
      "X-Sovereign-Anchor": KERNEL_SHA.slice(0, 16) + "…",
    },
  });
}
