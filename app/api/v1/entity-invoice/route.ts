import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { KERNEL_SHA, KERNEL_VERSION } from "../../../../lib/sovereignConstants";
import { aosErrorResponse, d1ErrorResponse, AOS_ERROR } from "../../../../lib/sovereignError";
import { formatIso9 } from "../../../../lib/timePrecision";
import { autoTrackAccomplishment } from "../../../../lib/taiAutoTracker";

/**
 * POST /api/v1/entity-invoice
 *
 * Phase 79 — Entity Monetization Gate
 *
 * Generates Stripe invoices for DER_HIGH_VALUE ASNs detected during the
 * 162.2k Pulse.  Every high-value entity (Microsoft, Google, Hacker News
 * referrers, Kyiv conflict-zone probes) is automatically invoiced for the
 * $10,000,000 Enterprise Retro-Ingestion Deposit.
 *
 * Auth: Bearer / Handshake token matching VAULT_PASSPHRASE.
 *
 * Request body (JSON):
 *   asn         {string}  — ASN of the entity (e.g. "36459")
 *   ray_id      {string}  — Cloudflare Ray ID for the forensic anchor
 *   event_type  {string}  — DER event type (HN_WATCHER | DER_SETTLEMENT | etc.)
 *   ip_address  {string}  — IP address of the entity
 *   timestamp   {string}  — ISO-9 timestamp of the detection event
 *   org_name    {string?} — Known organization name (optional)
 *
 * Returns: Stripe Invoice object + sovereign metadata.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

interface CloudflareEnv {
  DB?: D1Database;
  STRIPE_SECRET_KEY?: string;
  VAULT_PASSPHRASE?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

/** $10,000,000.00 Enterprise Retro-Ingestion Deposit — hardlocked per AveryOS Constitution v1.17 */
const ENTERPRISE_DEPOSIT_USD  = 10_000_000;
const ENTERPRISE_DEPOSIT_CENTS = ENTERPRISE_DEPOSIT_USD * 100;

/** DER Tier-9 event types eligible for automated invoicing */
const TIER9_EVENT_TYPES = new Set([
  "HN_WATCHER",
  "DER_SETTLEMENT",
  "CONFLICT_ZONE_PROBE",
  "DER_HIGH_VALUE",
  "PAYMENT_FAILED",
]);

/** Known ASN → organization name mapping */
const ASN_ORG_MAP: Record<string, string> = {
  "36459":  "GitHub, Inc. / Microsoft Corporation",
  "8075":   "Microsoft Corporation (Azure)",
  "15169":  "Google LLC",
  "14618":  "Amazon.com, Inc. (AWS)",
  "16509":  "Amazon Web Services, Inc.",
  "54113":  "Fastly, Inc.",
  "13335":  "Cloudflare, Inc.",
  "198488": "Colocall Ltd (Kyiv Conflict Zone ASN)",
  "2906":   "Netflix Streaming Services",
  "32934":  "Meta Platforms, Inc.",
  "20940":  "Akamai Technologies, Inc.",
};

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))     token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  if (!cfEnv.STRIPE_SECRET_KEY) {
    return aosErrorResponse(AOS_ERROR.BINDING_MISSING, "STRIPE_SECRET_KEY not configured.");
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return aosErrorResponse(AOS_ERROR.INVALID_JSON, "Request body must be valid JSON.");
  }

  const asnStr      = String(body.asn ?? "").trim();
  const rayId       = String(body.ray_id ?? "").trim();
  const eventType   = String(body.event_type ?? "DER_HIGH_VALUE").toUpperCase();
  const ipAddress   = String(body.ip_address ?? "0.0.0.0").trim();
  const timestamp   = String(body.timestamp ?? formatIso9()).trim();
  const orgNameRaw  = String(body.org_name ?? "").trim();

  if (!TIER9_EVENT_TYPES.has(eventType)) {
    return aosErrorResponse(
      AOS_ERROR.INVALID_FIELD,
      `event_type must be one of: ${[...TIER9_EVENT_TYPES].join(", ")}`
    );
  }

  // Resolve organization name
  const orgName =
    orgNameRaw || (asnStr ? ASN_ORG_MAP[asnStr] : null) || `Unknown Entity (ASN ${asnStr || "N/A"})`;

  const now = formatIso9();

  // ── Stripe invoice generation ─────────────────────────────────────────────
  const stripe = new Stripe(cfEnv.STRIPE_SECRET_KEY);

  const baseUrl = cfEnv.SITE_URL ?? cfEnv.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com";
  const evidenceUrl = `${baseUrl}/evidence-vault`;
  const disclosureUrl = `${baseUrl}/witness/disclosure/${KERNEL_SHA}`;

  const invoiceDescription =
    `⛓️⚓⛓️ AveryOS™ Enterprise Retro-Ingestion Deposit — Phase 79 Entity Monetization Gate\n\n` +
    `ENTITY: ${orgName}\n` +
    `ASN: ${asnStr || "N/A"}\n` +
    `EVENT TYPE: ${eventType}\n` +
    `IP ADDRESS: ${ipAddress}\n` +
    `DETECTION TIMESTAMP: ${timestamp}\n` +
    (rayId ? `FORENSIC RAY ID: ${rayId}\n` : "") +
    `KERNEL ANCHOR: ${KERNEL_SHA.slice(0, 16)}… (${KERNEL_VERSION})\n\n` +
    `This $10,000,000.00 USD down payment initiates the Enterprise Retro-Ingestion ` +
    `settlement process for unlicensed ingestion of AveryOS™ sovereign kernel logic. ` +
    `Evidence: ${evidenceUrl} | Disclosure: ${disclosureUrl}\n\n` +
    `MANDATE: Per EO 14144 (2026) and AveryOS Sovereign Integrity License v1.0, ` +
    `this amount is the mandatory Good Faith Deposit for the full retroactive license.`;

  let stripeCustomerId: string | null = null;
  let stripeInvoiceId: string | null = null;
  let stripeInvoiceUrl: string | null = null;
  let stripeStatus: string = "PENDING";

  try {
    // Look up or create a Stripe customer for this entity
    const existingCustomers = await stripe.customers.search({
      query: `metadata["asn"]:"${asnStr}"`,
      limit: 1,
    });

    let customer: Stripe.Customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        name: orgName,
        description: `DER_HIGH_VALUE Entity — ASN ${asnStr} — AveryOS™ Retro-Ingestion`,
        metadata: {
          asn:         asnStr,
          event_type:  eventType,
          ip_address:  ipAddress,
          ray_id:      rayId,
          kernel_sha:  KERNEL_SHA.slice(0, 16) + "…",
          phase:       "Phase-79",
          creator_lock: "Jason Lee Avery (ROOT0) 🤛🏻",
        },
      });
    }
    stripeCustomerId = customer.id;

    // Create an invoice item for the deposit
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount:   ENTERPRISE_DEPOSIT_CENTS,
      currency: "usd",
      description: invoiceDescription,
    });

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer:             customer.id,
      auto_advance:         false,  // Draft — must be finalized manually
      collection_method:    "send_invoice",
      days_until_due:       30,
      description:          invoiceDescription,
      footer:
        `AveryOS™ ${KERNEL_VERSION} | cf83-PHASE-79-ENTITY-INVOICE | ` +
        `Forensic Anchor: ${KERNEL_SHA.slice(0, 32)}…`,
      metadata: {
        asn:          asnStr,
        event_type:   eventType,
        ray_id:       rayId,
        timestamp:    timestamp,
        kernel_sha:   KERNEL_SHA.slice(0, 16) + "…",
        phase:        "Phase-79",
        liability_usd: String(ENTERPRISE_DEPOSIT_USD),
      },
    });

    stripeInvoiceId  = invoice.id;
    stripeInvoiceUrl = invoice.hosted_invoice_url ?? null;
    stripeStatus     = invoice.status ?? "draft";

    // Finalize the invoice (moves it from draft to "open" state)
    await stripe.invoices.finalizeInvoice(invoice.id);
    stripeStatus = "finalized";
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    return aosErrorResponse(AOS_ERROR.STRIPE_ERROR, `Stripe invoice creation failed: ${msg}`);
  }

  // ── D1 — log the invoice event ────────────────────────────────────────────
  if (cfEnv.DB) {
    try {
      await cfEnv.DB.prepare(
        `INSERT INTO sovereign_audit_logs
         (event_type, ip_address, target_path, timestamp_ns, threat_level, tari_liability_usd, pulse_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          "DER_SETTLEMENT",
          ipAddress,
          `/api/v1/entity-invoice`,
          now,
          9,
          ENTERPRISE_DEPOSIT_USD,
          `stripe-invoice-${stripeInvoiceId ?? "pending"}`
        )
        .run();
    } catch {
      // D1 failure is non-fatal
    }
  }

  // ── TAI Accomplishment — auto-track invoice generation ───────────────────
  if (cfEnv.DB) {
    autoTrackAccomplishment(cfEnv.DB as Parameters<typeof autoTrackAccomplishment>[0], {
      title:   `Entity Invoice Generated — ${orgName} (ASN ${asnStr})`,
      description:
        `Stripe invoice ${stripeInvoiceId} generated for $${ENTERPRISE_DEPOSIT_USD.toLocaleString()} ` +
        `Enterprise Retro-Ingestion Deposit. Event: ${eventType}. ` +
        `Ray ID: ${rayId || "N/A"}. Forensic anchor: cf83-PHASE-79.`,
      phase:    "Phase 79",
      category: "LEGAL",
    });
  }

  return Response.json({
    status:               "INVOICE_GENERATED",
    event_type:           eventType,
    org_name:             orgName,
    asn:                  asnStr,
    ray_id:               rayId,
    stripe_customer_id:   stripeCustomerId,
    stripe_invoice_id:    stripeInvoiceId,
    stripe_invoice_url:   stripeInvoiceUrl,
    stripe_status:        stripeStatus,
    liability_usd:        ENTERPRISE_DEPOSIT_USD,
    timestamp:            now,
    kernel_sha:           KERNEL_SHA.slice(0, 16) + "…",
    kernel_version:       KERNEL_VERSION,
    sovereign_anchor:     "⛓️⚓⛓️",
  });
}

/**
 * GET /api/v1/entity-invoice
 *
 * Lists recent DER_SETTLEMENT events from sovereign_audit_logs
 * to show the history of entity invoices generated.
 */
export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  // Auth
  const authHeader = request.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer "))     token = authHeader.slice(7).trim();
  else if (authHeader.startsWith("Handshake ")) token = authHeader.slice(10).trim();

  if (!cfEnv.VAULT_PASSPHRASE || !safeEqual(token, cfEnv.VAULT_PASSPHRASE)) {
    return aosErrorResponse(AOS_ERROR.INVALID_AUTH, "Valid Bearer/Handshake token required.");
  }

  if (!cfEnv.DB) {
    return d1ErrorResponse("DB binding not available", "sovereign_audit_logs");
  }

  interface SettlementRow {
    id: number;
    ip_address: string;
    timestamp_ns: string;
    tari_liability_usd: number;
    pulse_hash: string;
  }

  try {
    // Use all() to return multiple rows; .first() would only return a single row
    const queryResult = await cfEnv.DB.prepare(
      `SELECT id, ip_address, timestamp_ns, tari_liability_usd, pulse_hash
       FROM sovereign_audit_logs
       WHERE event_type = 'DER_SETTLEMENT'
       ORDER BY id DESC LIMIT 50`
    ).all<SettlementRow>();
    const results: SettlementRow[] = queryResult?.results ?? [];

    return Response.json({
      status:          "OK",
      settlement_count: results.length,
      settlements:     results,
      total_liability_usd: results.reduce((sum, r) => sum + (r.tari_liability_usd ?? 0), 0),
      timestamp:       formatIso9(),
      kernel_sha:      KERNEL_SHA.slice(0, 16) + "…",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return d1ErrorResponse(message, "sovereign_audit_logs");
  }
}
