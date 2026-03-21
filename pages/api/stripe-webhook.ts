import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import {
  sovereignWriteSync,
  sovereignReadSync,
} from "../../lib/security/pathSanitizer";

export const config = {
  api: {
    bodyParser: false,
  },
};

const LEDGER_FILENAME = "vaultchain_revenue_ledger.json";

/** Read raw request body as a Buffer for Stripe signature verification. */
function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

type LedgerEntry = {
  timestamp: string;
  sessionId: string;
  nodeId: string;
  amountTotal: number;
  currency: string;
  customerEmail: string | null;
  grantFile: string;
};

function appendLedger(entry: LedgerEntry): void {
  const ledger = sovereignReadSync<LedgerEntry[]>(LEDGER_FILENAME, []);
  ledger.push(entry);
  sovereignWriteSync(LEDGER_FILENAME, ledger);
}

/**
 * Write a temporary Sovereign Grant file for the debtor node.
 * The Lighthouse Bridge checks this directory to stop returning 402s for
 * the duration of the license.
 *
 * @returns the grant filename written inside vault_storage/
 */
function writeSovereignGrant(nodeId: string, sessionId: string): string {
  const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const fileName = `grant_${safeNodeId}.json`;
  const grant = {
    nodeId,
    sessionId,
    grantedAt: new Date().toISOString(),
    // 30-day license duration
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
  };
  sovereignWriteSync(fileName, grant);
  return fileName;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("⚠️  STRIPE_WEBHOOK_SECRET is not configured.");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("⚠️  STRIPE_SECRET_KEY is not configured.");
    return res.status(500).json({ error: "Stripe secret key not configured" });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" });

  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch {
    return res.status(400).json({ error: "Failed to read request body" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`⚠️  Stripe webhook signature verification failed: ${message}`);
    return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const nodeId = session.metadata?.node_id || session.metadata?.nodeId || session.client_reference_id || null;

    if (!nodeId) {
      console.warn(`⚠️  checkout.session.completed (${session.id}) has no node_id in metadata or client_reference_id — skipping grant.`);
      return res.status(200).json({ received: true });
    }

    if (session.amount_total == null) {
      console.warn(`⚠️  checkout.session.completed (${session.id}) has null amount_total — session may be incomplete.`);
      return res.status(200).json({ received: true });
    }

    const grantFile = writeSovereignGrant(nodeId, session.id);
    console.log(`✅ Sovereign Grant written for Node ${nodeId}: ${grantFile}`);

    const ledgerEntry: LedgerEntry = {
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      nodeId,
      amountTotal: session.amount_total,
      currency: session.currency ?? "usd",
      customerEmail: session.customer_details?.email ?? null,
      grantFile,
    };
    appendLedger(ledgerEntry);
    console.log(`📒 Settlement recorded in vaultchain_revenue_ledger.json for session ${session.id}`);
  }

  return res.status(200).json({ received: true });
};

export default handler;
