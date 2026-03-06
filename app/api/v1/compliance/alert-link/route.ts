import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../../lib/sovereignConstants";
import { formatIso9 } from "../../../../../lib/timePrecision";
import { aosErrorResponse, AOS_ERROR } from "../../../../../lib/sovereignError";
import { capsuleKey } from "../../../../../lib/storageUtils";

/**
 * POST /api/v1/compliance/alert-link
 *
 * Uploads a .aoscap evidence bundle to the VAULT R2 bucket and returns a
 * KV-backed 24-hour signed URL for secure delivery to the Note 20 dashboard.
 * Optionally fires a GabrielOS™ Pushover push notification on Tier-9 events.
 *
 * Request body (JSON):
 *   {
 *     bundleId:      string;   // Evidence bundle ID, e.g. "EVIDENCE_BUNDLE_1.2.3.4_2026..."
 *     bundlePayload: object;   // The .aoscap JSON content to store in R2
 *     targetIp?:     string;   // IP address of the unaligned entity (for push message)
 *     tariLiability?: number;  // TARI™ liability in USD (for push message; default 1017)
 *   }
 *
 * Response:
 *   {
 *     signedUrl:  string;   // 24-hour expiring download URL
 *     bundleKey:  string;   // R2 object key
 *     expiresAt:  string;   // ISO-9 timestamp when the link expires
 *     pulseHash:  string;   // SHA-512 anchor of the upload
 *   }
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ---------------------------------------------------------------------------
// Cloudflare binding interface
// ---------------------------------------------------------------------------

interface R2Bucket {
  put(key: string, value: string): Promise<void>;
}

interface KVNamespace {
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface CloudflareEnv {
  VAULT: R2Bucket;
  KV_LOGS: KVNamespace;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
}

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

/** SHA-512 hex digest via WebCrypto. */
async function sha512(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Non-blocking Pushover GabrielOS™ push — never throws. */
function firePushover(
  appToken: string,
  userKey: string,
  title: string,
  message: string
): void {
  const body = new URLSearchParams({
    token: appToken,
    user: userKey,
    title,
    message,
    priority: "1",
    sound: "siren",
    url: "https://averyos.com/evidence-vault",
    url_title: "🔐 Evidence Vault",
  });
  fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

const SIGNED_LINK_TTL_SECONDS = 86_400; // 24 hours

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    // ── Auth ──────────────────────────────────────────────────────────────
    const passphrase = cfEnv.VAULT_PASSPHRASE ?? "";
    if (!passphrase) {
      return aosErrorResponse(
        AOS_ERROR.VAULT_NOT_CONFIGURED,
        "VAULT_PASSPHRASE secret is not set."
      );
    }
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!safeEqual(token, passphrase)) {
      return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Invalid VAULT_PASSPHRASE.");
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return aosErrorResponse(
        AOS_ERROR.INVALID_JSON,
        "Request body must be valid JSON with Content-Type: application/json."
      );
    }

    if (typeof body !== "object" || body === null) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD, "Request body is invalid.");
    }

    const {
      bundleId,
      bundlePayload,
      targetIp,
      tariLiability,
    } = body as Record<string, unknown>;

    if (typeof bundleId !== "string" || !bundleId.trim()) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "bundleId is required.");
    }
    if (typeof bundlePayload !== "object" || bundlePayload === null) {
      return aosErrorResponse(AOS_ERROR.MISSING_FIELD, "bundlePayload (the .aoscap JSON object) is required.");
    }

    const timestamp = formatIso9();

    // ── Build R2 key ──────────────────────────────────────────────────────
    const safeId = bundleId.replace(/[^a-zA-Z0-9_\-.]/g, "_").slice(0, 80);
    const r2Key = capsuleKey(`evidence/${safeId}.aoscap`);

    // ── Compute pulse hash ────────────────────────────────────────────────
    const pulseHash = await sha512(
      `${bundleId}|${timestamp}|${KERNEL_SHA}`
    );

    // ── Annotate payload with sovereign metadata ──────────────────────────
    const annotatedPayload = {
      ...(bundlePayload as Record<string, unknown>),
      _r2Key: r2Key,
      _uploadedAt: timestamp,
      _pulseHash: pulseHash,
      _kernelVersion: KERNEL_VERSION,
    };

    // ── Upload to R2 ──────────────────────────────────────────────────────
    await cfEnv.VAULT.put(r2Key, JSON.stringify(annotatedPayload, null, 2));

    // ── Generate KV-backed signed URL ─────────────────────────────────────
    // A unique access token is stored in KV with a 24 h TTL.  The download
    // endpoint reads the token and serves the content from R2.
    const accessToken = pulseHash.slice(0, 64);
    const kvKey = `evidence_link:${accessToken}`;
    await cfEnv.KV_LOGS.put(
      kvKey,
      JSON.stringify({ r2Key, bundleId, createdAt: timestamp }),
      { expirationTtl: SIGNED_LINK_TTL_SECONDS }
    );

    const siteUrl =
      cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
    const signedUrl = `${siteUrl}/api/v1/compliance/evidence-download?token=${accessToken}`;

    const expiresAt = formatIso9(new Date(Date.now() + SIGNED_LINK_TTL_SECONDS * 1_000));

    // ── GabrielOS™ Pushover push (non-blocking) ───────────────────────────
    if (cfEnv.PUSHOVER_APP_TOKEN && cfEnv.PUSHOVER_USER_KEY) {
      const ipLabel =
        typeof targetIp === "string" && targetIp ? targetIp : "unknown";
      const liability =
        typeof tariLiability === "number" && tariLiability > 0
          ? tariLiability
          : 1017;
      const liabilityFormatted = liability.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      });
      firePushover(
        cfEnv.PUSHOVER_APP_TOKEN,
        cfEnv.PUSHOVER_USER_KEY,
        "⚖️ GabrielOS™ Evidence Alert",
        `🚨 UNALIGNED entity detected: ${ipLabel}\n` +
          `💰 TARI™ liability: ${liabilityFormatted}\n` +
          `📦 Bundle: ${bundleId}\n` +
          `🔗 Link expires: ${expiresAt}`
      );
    }

    return Response.json({
      signedUrl,
      bundleKey: r2Key,
      expiresAt,
      pulseHash: pulseHash.slice(0, 32) + "…",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return aosErrorResponse(AOS_ERROR.INTERNAL_ERROR, message);
  }
}
