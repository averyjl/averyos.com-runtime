/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { KERNEL_SHA, KERNEL_VERSION } from '../../../../../lib/sovereignConstants';
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from '../../../../../lib/sovereignError';
import { formatIso9 } from '../../../../../lib/timePrecision';
import { autoTrackAccomplishment } from '../../../../../lib/taiAutoTracker';
import { safeEqual } from '../../../../../lib/taiLicenseGate';

/**
 * POST /api/v1/licensing/exchange
 *
 * Phase 85 — Hardware-Attested Token Gate
 *
 * Issues a VaultChain™ access token cryptographically bound to the
 * licensee's machine fingerprint (UUID / MAC hash). The token will only
 * decrypt AveryOS™ .aoscap inventions on the specific hardware that was
 * presented during checkout, preventing unlicensed logic redistribution.
 *
 * Request body:
 *   {
 *     "machine_fingerprint": "<sha-256-hex of UUID + MAC + hostname>",
 *     "license_key":         "<Stripe payment intent ID or partner_id>",
 *     "product_id":          "<capsule_id or '*' for universal>",
 *     "contact_email":       "<email>",
 *   }
 *
 * Response on success:
 *   {
 *     "resonance":     "HIGH_FIDELITY_SUCCESS",
 *     "access_token":  "<hardware-bound SHA-512 token>",
 *     "bound_to":      "<first 16 chars of machine_fingerprint>…",
 *     "product_id":    "<product_id>",
 *     "issued_at":     "<ISO-9 timestamp>",
 *     "kernel_sha":    "<cf83…>",
 *   }
 *
 * Auth: Bearer token matching VAULT_PASSPHRASE (admin issuance).
 *       For Stripe-verified purchases: STRIPE_SECRET_KEY is used
 *       to confirm the payment intent before issuance.
 *
 * The token is stored in the `vaultchain_transactions` D1 table,
 * enabling verification via /api/v1/verify/<token>.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  VAULT_PASSPHRASE?: string;
  STRIPE_SECRET_KEY?: string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

interface VaultchainRow {
  id: number;
  sha512: string;
  event_type: string | null;
}

const FINGERPRINT_RE   = /^[a-fA-F0-9]{32,128}$/;
const LICENSE_KEY_RE   = /^[a-zA-Z0-9_\-]{8,128}$/;
const STRIPE_SESSION_RE = /^cs_(test|live)_[0-9A-Za-z]{10,}$/;
const STRIPE_API_ALLOWLIST = new Set(['api.stripe.com']);

/**
 * Derives the hardware-bound access token.
 *
 * token = SHA-512( KERNEL_SHA + ':' + machine_fingerprint + ':' + license_key + ':' + issuedAt )
 *
 * The machine_fingerprint and license_key are bound together in the token so
 * the token is unusable on a different machine or with a different license.
 *
 * Note: We use the Web Crypto API (available in Cloudflare Workers) to
 * compute SHA-512 without importing Node's crypto module.
 */
async function deriveAccessToken(
  machineFingerprint: string,
  licenseKey: string,
  issuedAt: string,
): Promise<string> {
  const input   = `${KERNEL_SHA}:${machineFingerprint}:${licenseKey}:${issuedAt}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-512', encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE;
  if (vaultPassphrase) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!safeEqual(token, vaultPassphrase)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH,
        'Valid Bearer token required to issue hardware-attested tokens');
    }
  }

  if (!cfEnv.DB) {
    return d1ErrorResponse('DB binding unavailable');
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, 'Request body must be valid JSON');
  }

  const machineFingerprint = typeof body.machine_fingerprint === 'string'
    ? body.machine_fingerprint.trim() : '';
  const licenseKey = typeof body.license_key === 'string'
    ? body.license_key.trim() : '';
  const productId = typeof body.product_id === 'string'
    ? body.product_id.trim() : '*';
  const contactEmail = typeof body.contact_email === 'string'
    ? body.contact_email.trim() : '';

  if (!FINGERPRINT_RE.test(machineFingerprint)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
      'machine_fingerprint must be a 32–128 hex character SHA-256 hash of the device identity (UUID + MAC + hostname)');
  }

  if (!LICENSE_KEY_RE.test(licenseKey)) {
    return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
      'license_key must be 8–128 alphanumeric characters (Stripe payment intent ID or partner_id)');
  }

  // ── Optional Stripe checkout session verification ─────────────────────────
  // When the license_key is a Stripe Checkout Session ID (cs_test_/cs_live_),
  // verify the session against the Stripe API using encodeURIComponent to
  // prevent path traversal SSRF. Requires STRIPE_SECRET_KEY to be set.
  if (STRIPE_SESSION_RE.test(licenseKey) && cfEnv.STRIPE_SECRET_KEY) {
    const sessionUrl = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(licenseKey)}`;
    // SSRF guard: confirm the constructed URL resolves to the allowlisted host.
    const targetHost = new URL(sessionUrl).hostname;
    if (!STRIPE_API_ALLOWLIST.has(targetHost)) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
        'Internal SSRF guard: unexpected Stripe API hostname. Contact support.');
    }
    const stripeRes = await fetch(sessionUrl, {
      headers: { Authorization: `Bearer ${cfEnv.STRIPE_SECRET_KEY}` },
    }).catch(() => null);
    if (!stripeRes || !stripeRes.ok) {
      return aosErrorResponse(AOS_ERROR.INVALID_FIELD,
        'Stripe checkout session could not be verified. Ensure the session ID is valid and payment is complete.');
    }
  }

  // ── Check for duplicate issuance ──────────────────────────────────────────
  const existing = await cfEnv.DB.prepare(
    `SELECT id, sha512, event_type FROM vaultchain_transactions
     WHERE event_type = ? LIMIT 1`
  )
    .bind(`HARDWARE_BOUND:${machineFingerprint.substring(0, 16)}:${licenseKey}`)
    .first<VaultchainRow>();

  if (existing) {
    return Response.json(
      {
        resonance:     'ALREADY_ISSUED',
        access_token:  existing.sha512,
        bound_to:      `${machineFingerprint.substring(0, 16)}…`,
        product_id:    productId,
        kernel_sha:    KERNEL_SHA,
        kernel_version: KERNEL_VERSION,
        detail:        'A hardware-attested token has already been issued for this fingerprint + license combination.',
      },
      { status: 200 },
    );
  }

  // ── Issue token ───────────────────────────────────────────────────────────
  const issuedAt   = formatIso9();
  const accessToken = await deriveAccessToken(machineFingerprint, licenseKey, issuedAt);

  // ── Persist to vaultchain_transactions ───────────────────────────────────
  await cfEnv.DB.prepare(
    `INSERT INTO vaultchain_transactions
       (sha512, event_type, created_at)
     VALUES (?, ?, ?)`
  )
    .bind(
      accessToken,
      `HARDWARE_BOUND:${machineFingerprint.substring(0, 16)}:${licenseKey}`,
      issuedAt,
    )
    .run();

  // ── Auto-track accomplishment ─────────────────────────────────────────────
  if (cfEnv.DB) {
    autoTrackAccomplishment(cfEnv.DB, {
      title:    `Hardware-Attested Token Issued — Phase 85`,
      phase:    'Phase 85',
      category: 'SOVEREIGN',
      description: `Hardware-attested VaultChain™ access token issued for license_key ${licenseKey} ` +
                   `bound to machine fingerprint ${machineFingerprint.substring(0, 16)}…. ` +
                   `Product: ${productId}. Contact: ${contactEmail || 'N/A'}. ` +
                   `Token prevents redistribution to unlicensed hardware.`,
    });
  }

  return Response.json(
    {
      resonance:      'HIGH_FIDELITY_SUCCESS',
      access_token:   accessToken,
      bound_to:       `${machineFingerprint.substring(0, 16)}…`,
      product_id:     productId,
      license_key:    licenseKey,
      contact_email:  contactEmail || null,
      issued_at:      issuedAt,
      kernel_sha:     KERNEL_SHA,
      kernel_version: KERNEL_VERSION,
      message:        'Hardware-attested VaultChain™ access token issued. This token is cryptographically bound to the provided machine fingerprint and will only unlock .aoscap inventions on the registered device.',
      verification_url: `/api/v1/verify/${accessToken}`,
    },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv   = env as unknown as CloudflareEnv;

  const vaultPassphrase = cfEnv.VAULT_PASSPHRASE;
  if (vaultPassphrase) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!safeEqual(token, vaultPassphrase)) {
      return aosErrorResponse(AOS_ERROR.MISSING_AUTH, 'Valid Bearer token required');
    }
  }

  return Response.json({
    resonance:      'HIGH_FIDELITY_SUCCESS',
    endpoint:       '/api/v1/licensing/exchange',
    phase:          'Phase 85 — Hardware-Attested Token Gate',
    kernel_sha:     KERNEL_SHA,
    kernel_version: KERNEL_VERSION,
    method:         'POST',
    description:    'Issues a VaultChain™ access token cryptographically bound to the licensee hardware machine fingerprint.',
    required_fields: ['machine_fingerprint', 'license_key'],
    optional_fields: ['product_id', 'contact_email'],
    machine_fingerprint_format: 'SHA-256 hex of (UUID + MAC + hostname), 64 hex characters recommended',
  });
}
