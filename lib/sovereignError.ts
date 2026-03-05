/**
 * AveryOS™ Sovereign Error Standard
 *
 * Centralised error handling for all AveryOS™ surfaces:
 *   • App Router API routes
 *   • Pages API handlers
 *   • Edge middleware
 *   • Client-side UI components
 *   • Node.js scripts
 *
 * Core principles:
 *   1. ROOT CAUSE ANALYSIS (RCA) — every error carries a diagnosis.
 *   2. AUTO-HEAL — known errors attempt self-recovery before surfacing.
 *   3. ACTIONABLE — every user-facing message tells the user what to do next.
 *   4. SOVEREIGN BRANDING — errors carry the AveryOS™ identity.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ---------------------------------------------------------------------------
// Error code catalogue
// ---------------------------------------------------------------------------

export const AOS_ERROR = {
  // Auth / Access
  MISSING_AUTH:          'MISSING_AUTH',
  INVALID_AUTH:          'INVALID_AUTH',
  VAULT_NOT_CONFIGURED:  'VAULT_NOT_CONFIGURED',
  FORBIDDEN:             'FORBIDDEN',

  // Input
  INVALID_JSON:          'INVALID_JSON',
  MISSING_FIELD:         'MISSING_FIELD',
  INVALID_FIELD:         'INVALID_FIELD',
  INVALID_IP:            'INVALID_IP',

  // D1 / KV bindings
  DB_UNAVAILABLE:        'DB_UNAVAILABLE',
  DB_QUERY_FAILED:       'DB_QUERY_FAILED',
  KV_UNAVAILABLE:        'KV_UNAVAILABLE',
  KV_WRITE_FAILED:       'KV_WRITE_FAILED',
  BINDING_MISSING:       'BINDING_MISSING',

  // Business logic
  NOT_FOUND:             'NOT_FOUND',
  ALREADY_EXISTS:        'ALREADY_EXISTS',
  LICENSE_INVALID:       'LICENSE_INVALID',
  TOKEN_EXPIRED:         'TOKEN_EXPIRED',
  STRIPE_ERROR:          'STRIPE_ERROR',
  SETTLEMENT_FAILED:     'SETTLEMENT_FAILED',

  // External services
  EXTERNAL_API_ERROR:    'EXTERNAL_API_ERROR',
  BTC_ANCHOR_FAILED:     'BTC_ANCHOR_FAILED',
  PUSHOVER_FAILED:       'PUSHOVER_FAILED',

  // Internal
  INTERNAL_ERROR:        'INTERNAL_ERROR',
  DRIFT_DETECTED:        'DRIFT_DETECTED',
} as const;

export type AosErrorCode = (typeof AOS_ERROR)[keyof typeof AOS_ERROR];

// ---------------------------------------------------------------------------
// RCA + auto-heal registry
// ---------------------------------------------------------------------------

interface RcaEntry {
  /** Plain-English diagnosis shown to users/operators. */
  diagnosis: string;
  /** Ordered list of actionable steps to resolve. */
  steps: string[];
  /** HTTP status code to return. */
  status: number;
  /**
   * Auto-heal function. Return `true` if the error was healed silently.
   * Return `false` to surface the error to the caller.
   */
  autoHeal?: (ctx: ErrorContext) => Promise<boolean> | boolean;
}

interface ErrorContext {
  code: AosErrorCode;
  detail: string;
  /** Original caught error, if any. */
  cause?: unknown;
  /** Surface: api | ui | script | middleware */
  surface?: 'api' | 'ui' | 'script' | 'middleware';
  /** Optional extra metadata for auto-heal decisions. */
  meta?: Record<string, unknown>;
}

const RCA_REGISTRY: Partial<Record<AosErrorCode, RcaEntry>> = {
  [AOS_ERROR.MISSING_AUTH]: {
    diagnosis: 'No authorisation token was provided.',
    steps: [
      'Add an `Authorization: Bearer <your-VAULT_PASSPHRASE>` header to the request.',
      'Retrieve your passphrase from the AveryOS™ Vault Gate at /vault-gate.',
    ],
    status: 401,
  },
  [AOS_ERROR.INVALID_AUTH]: {
    diagnosis: 'The provided authorisation token does not match the Sovereign Passphrase.',
    steps: [
      'Verify the token at /vault-gate.',
      'Re-authenticate using the YubiKey Handshake flow.',
      'If the issue persists, the VAULT_PASSPHRASE environment variable may need to be rotated.',
    ],
    status: 401,
  },
  [AOS_ERROR.VAULT_NOT_CONFIGURED]: {
    diagnosis: 'The VAULT_PASSPHRASE secret has not been set in this environment.',
    steps: [
      'Add VAULT_PASSPHRASE to your Cloudflare Worker secrets: `wrangler secret put VAULT_PASSPHRASE`.',
      'Redeploy the Worker after setting the secret.',
    ],
    status: 503,
  },
  [AOS_ERROR.INVALID_JSON]: {
    diagnosis: 'The request body could not be parsed as JSON.',
    steps: [
      'Ensure the `Content-Type: application/json` header is set.',
      'Validate the request body is well-formed JSON before sending.',
    ],
    status: 400,
  },
  [AOS_ERROR.MISSING_FIELD]: {
    diagnosis: 'A required field is missing from the request.',
    steps: [
      'Check the API documentation for required fields.',
      'Ensure all required fields are present in the request body.',
    ],
    status: 400,
  },
  [AOS_ERROR.INVALID_FIELD]: {
    diagnosis: 'A field in the request has an invalid format or value.',
    steps: [
      'Review the field requirements in the API documentation.',
      'Correct the field value and retry.',
    ],
    status: 400,
  },
  [AOS_ERROR.INVALID_IP]: {
    diagnosis: 'The provided IP address is not a valid IPv4 or IPv6 address.',
    steps: [
      'Use a standard dotted-decimal IPv4 (e.g. 203.0.113.42) or compressed IPv6 format.',
      'Hostnames and CIDR ranges are not accepted — supply the raw IP address.',
    ],
    status: 400,
  },
  [AOS_ERROR.DB_UNAVAILABLE]: {
    diagnosis: 'The D1 database binding is not reachable.',
    steps: [
      'Verify the `DB` binding is declared in wrangler.toml under [[d1_databases]].',
      'Run `wrangler d1 list` to confirm the database exists.',
      'Check Cloudflare dashboard for D1 service incidents.',
    ],
    status: 503,
    autoHeal: async (ctx) => {
      // Log the D1 outage to console so it is captured in Worker tail logs
      console.error(`[AOS RCA] DB_UNAVAILABLE — ${ctx.detail}`);
      return false; // Cannot self-heal a missing binding
    },
  },
  [AOS_ERROR.DB_QUERY_FAILED]: {
    diagnosis: 'A D1 database query failed at runtime.',
    steps: [
      'Check the error detail for the specific SQL error message.',
      'Verify the table exists by running `wrangler d1 execute <db> --command "SELECT name FROM sqlite_master WHERE type=\'table\'"` .',
      'Apply any missing migrations: `wrangler d1 migrations apply <db>`.',
    ],
    status: 500,
  },
  [AOS_ERROR.KV_UNAVAILABLE]: {
    diagnosis: 'The KV namespace binding is not reachable.',
    steps: [
      'Verify the KV binding (e.g. KV_LOGS) is declared in wrangler.toml under [[kv_namespaces]].',
      'Run `wrangler kv namespace list` to confirm the namespace exists.',
    ],
    status: 503,
  },
  [AOS_ERROR.BINDING_MISSING]: {
    diagnosis: 'A required Cloudflare binding (D1, KV, or R2) is not configured for this environment.',
    steps: [
      'Add the binding to wrangler.toml.',
      'For local dev, add it to .dev.vars or the [vars] section.',
      'Redeploy: `npm run deploy`.',
    ],
    status: 503,
  },
  [AOS_ERROR.NOT_FOUND]: {
    diagnosis: 'The requested resource was not found.',
    steps: [
      'Verify the resource ID or path is correct.',
      'The resource may have been deleted or not yet created.',
    ],
    status: 404,
  },
  [AOS_ERROR.LICENSE_INVALID]: {
    diagnosis: 'The provided license or download token is invalid or has been revoked.',
    steps: [
      'Re-purchase the capsule at /capsules to generate a new license.',
      'If you believe this is an error, contact support via /compliance.',
    ],
    status: 403,
  },
  [AOS_ERROR.TOKEN_EXPIRED]: {
    diagnosis: 'The download token has passed its 48-hour validity window.',
    steps: [
      'Purchase a new license to receive a fresh download token.',
      'Download tokens are valid for 48 hours from time of purchase.',
    ],
    status: 403,
  },
  [AOS_ERROR.STRIPE_ERROR]: {
    diagnosis: 'A Stripe payment or webhook error occurred.',
    steps: [
      'Check the Stripe dashboard for payment status.',
      'Verify STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set correctly.',
      'Retry the payment or contact support.',
    ],
    status: 502,
  },
  [AOS_ERROR.EXTERNAL_API_ERROR]: {
    diagnosis: 'An external API call failed.',
    steps: [
      'Check the `detail` field for the specific API and HTTP status.',
      'The external service may be temporarily unavailable — retry in a few minutes.',
    ],
    status: 502,
  },
  [AOS_ERROR.BTC_ANCHOR_FAILED]: {
    diagnosis: 'The Bitcoin block height anchor could not be fetched from BlockCypher.',
    steps: [
      'Set the BLOCKCHAIN_API_KEY environment variable to avoid rate limiting.',
      'The evidence bundle will be generated with an offline anchor — this is acceptable.',
    ],
    status: 200, // Non-fatal; bundle still proceeds
    autoHeal: () => true, // Always heal — offline anchor is acceptable
  },
  [AOS_ERROR.INTERNAL_ERROR]: {
    diagnosis: 'An unexpected internal error occurred.',
    steps: [
      'Check the Worker tail logs: `wrangler tail averyoscom-runtime`.',
      'If the error persists, open a Sovereign Support ticket at /compliance.',
    ],
    status: 500,
  },
  [AOS_ERROR.DRIFT_DETECTED]: {
    diagnosis: 'Kernel drift detected — the system state does not match the Root0 anchor.',
    steps: [
      'Verify the current KERNEL_SHA in lib/sovereignConstants.ts matches the VaultBridge manifest.',
      'Re-deploy from the canonical branch: `npm run deploy`.',
      'If drift persists, initiate a full VaultEcho snapshot.',
    ],
    status: 500,
  },
};

// ---------------------------------------------------------------------------
// Core error builder — used by API routes
// ---------------------------------------------------------------------------

export interface AosApiError {
  error: AosErrorCode;
  detail: string;
  diagnosis: string;
  steps: string[];
  sovereign_anchor: '⛓️⚓⛓️';
  timestamp: string;
}

/**
 * Build a standardised AveryOS™ error response body.
 * Includes RCA diagnosis and actionable steps for every known error code.
 */
export function buildAosError(
  code: AosErrorCode,
  detail: string,
  overrides?: Partial<Pick<RcaEntry, 'diagnosis' | 'steps'>>
): AosApiError {
  const rca = RCA_REGISTRY[code];
  return {
    error: code,
    detail,
    diagnosis: overrides?.diagnosis ?? rca?.diagnosis ?? 'An unexpected error occurred.',
    steps: overrides?.steps ?? rca?.steps ?? [
      'Check the server logs for more detail.',
      'Contact support at /compliance if the issue persists.',
    ],
    sovereign_anchor: '⛓️⚓⛓️',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Return a `Response` with the standardised AveryOS™ error body.
 *
 * Usage in API routes:
 * ```ts
 * return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, 'SELECT 1 failed');
 * ```
 */
export function aosErrorResponse(
  code: AosErrorCode,
  detail: string,
  statusOverride?: number
): Response {
  const rca = RCA_REGISTRY[code];
  const status = statusOverride ?? rca?.status ?? 500;
  const body = buildAosError(code, detail);
  return Response.json(body, { status });
}

/**
 * Wrap an async API handler with automatic RCA error catching.
 * - Catches all errors thrown inside the handler.
 * - Classifies known D1/KV errors automatically.
 * - Returns a standardised AOS error response.
 *
 * Usage:
 * ```ts
 * export const GET = withAosErrorHandling(async (request) => {
 *   // ... handler logic ...
 * });
 * ```
 */
export function withAosErrorHandling(
  handler: (request: Request, ctx?: unknown) => Promise<Response>
): (request: Request, ctx?: unknown) => Promise<Response> {
  return async (request: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(request, ctx);
    } catch (err: unknown) {
      return classifyAndRespond(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Error classification — maps raw errors to AOS codes
// ---------------------------------------------------------------------------

/**
 * Classify a raw caught error and return the appropriate AOS error Response.
 * Performs RCA analysis on the error message to pick the most specific code.
 */
export function classifyAndRespond(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  let code: AosErrorCode = AOS_ERROR.INTERNAL_ERROR;

  if (lower.includes('d1') || lower.includes('sqlite') || lower.includes('no such table')) {
    code = AOS_ERROR.DB_QUERY_FAILED;
  } else if (lower.includes('kv') || lower.includes('namespace')) {
    code = AOS_ERROR.KV_UNAVAILABLE;
  } else if (lower.includes('stripe')) {
    code = AOS_ERROR.STRIPE_ERROR;
  } else if (lower.includes('binding') || lower.includes('env.db') || lower.includes('env.kv')) {
    code = AOS_ERROR.BINDING_MISSING;
  } else if (lower.includes('json') || lower.includes('parse')) {
    code = AOS_ERROR.INVALID_JSON;
  } else if (lower.includes('unauthorized') || lower.includes('unauthenticated')) {
    code = AOS_ERROR.INVALID_AUTH;
  } else if (lower.includes('expired')) {
    code = AOS_ERROR.TOKEN_EXPIRED;
  } else if (lower.includes('not found') || lower.includes('404')) {
    code = AOS_ERROR.NOT_FOUND;
  } else if (lower.includes('drift')) {
    code = AOS_ERROR.DRIFT_DETECTED;
  }

  return aosErrorResponse(code, message);
}

// ---------------------------------------------------------------------------
// Script / Node.js error logger
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const GREEN = '\x1b[32m';

/**
 * Log a Sovereign RCA error to the console (for Node.js scripts).
 * Prints: error code, human diagnosis, ordered recovery steps.
 *
 * Usage in scripts:
 * ```js
 * import { logAosScriptError, AOS_ERROR } from '../lib/sovereignError.js';
 * logAosScriptError(AOS_ERROR.DB_QUERY_FAILED, err.message);
 * ```
 */
export function logAosScriptError(
  code: AosErrorCode,
  detail: string,
  cause?: unknown
): void {
  const rca = RCA_REGISTRY[code];
  console.error('');
  console.error(`${RED}❌ [AOS ERROR] ${code}${RESET}`);
  console.error(`${YELLOW}   Diagnosis : ${rca?.diagnosis ?? 'Unexpected error'}${RESET}`);
  console.error(`${CYAN}   Detail    : ${detail}${RESET}`);
  if (cause instanceof Error && cause.stack) {
    console.error(`${CYAN}   Stack     : ${cause.stack.split('\n').slice(0, 3).join(' | ')}${RESET}`);
  }
  if (rca?.steps?.length) {
    console.error(`${GREEN}   ── Actionable Steps ──${RESET}`);
    rca.steps.forEach((step, i) => {
      console.error(`${GREEN}   ${i + 1}. ${step}${RESET}`);
    });
  }
  console.error('');
}

/**
 * Log a recovery (auto-heal) notice to the console.
 */
export function logAosHeal(code: AosErrorCode, action: string): void {
  console.warn(`${YELLOW}🔄 [AOS AUTO-HEAL] ${code} — ${action}${RESET}`);
}

// ---------------------------------------------------------------------------
// UI error payload (serialisable for client components)
// ---------------------------------------------------------------------------

export interface AosUiError {
  code: AosErrorCode;
  detail: string;
  diagnosis: string;
  steps: string[];
}

/**
 * Build a lightweight serialisable error object for React state.
 * Pass this to `<SovereignErrorBanner error={...} />`.
 */
export function buildAosUiError(
  code: AosErrorCode,
  detail: string
): AosUiError {
  const rca = RCA_REGISTRY[code];
  return {
    code,
    detail,
    diagnosis: rca?.diagnosis ?? 'An unexpected error occurred.',
    steps: rca?.steps ?? ['Refresh the page and try again.', 'Contact support at /compliance if the issue persists.'],
  };
}

/**
 * Classify an API error response body (fetched from an AOS route) into a
 * `AosUiError` for display in client components.
 */
export function classifyApiResponseError(
  body: Record<string, unknown>
): AosUiError {
  const code = (body.error as AosErrorCode | undefined) ?? AOS_ERROR.INTERNAL_ERROR;
  const detail = (body.detail as string | undefined) ?? String(body.error ?? 'Unknown error');
  return buildAosUiError(code, detail);
}
