/**
 * USI/DT Infraction Log — API Route
 * POST /api/infraction/log
 *
 * Records a $10,000 USI (Unlawful Session Interference) or DT (Digital Trespass)
 * infraction event to the persistent infraction ledger at:
 *   vault_storage/infraction_ledger.json
 *
 * Security: No secrets are hardcoded. All env vars via process.env.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import {
  sovereignWriteSync,
  sovereignReadSync,
} from "../../../lib/security/pathSanitizer";

const LEDGER_FILENAME = "infraction_ledger.json";

const USI_DT_PENALTY_USD = 10_000.00;

// Truncated anchor reference used in ledger entries (full hash in FooterBadge)
const KERNEL_ANCHOR_SHORT = "cf83e135...927da3e";

export interface InfractionEntry {
  id: string;           // SHA-256 of (timestamp + entity + type)
  timestamp: string;
  entityName: string;
  entityRevenue: number;
  infractionType: "USI" | "DT" | "USI/DT";
  description: string;
  penaltyUsd: number;
  ip: string;
  kernelAnchor: string;
}

function readLedger(): InfractionEntry[] {
  return sovereignReadSync<InfractionEntry[]>(LEDGER_FILENAME, []);
}

function writeLedger(entries: InfractionEntry[]): void {
  sovereignWriteSync(LEDGER_FILENAME, entries);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const ledger = readLedger();
    const totalPenaltyUsd = ledger.reduce((sum, e) => sum + e.penaltyUsd, 0);
    return res.status(200).json({
      infractions: ledger,
      count: ledger.length,
      totalPenaltyUsd,
      billingModel: "ALF_v4.0",
      kernelAnchor: KERNEL_ANCHOR_SHORT,
    });
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const timestamp = new Date().toISOString();

    const entityName =
      typeof body.entityName === "string" && body.entityName.trim()
        ? body.entityName.trim().slice(0, 200)
        : null;

    if (!entityName) {
      return res.status(400).json({ error: "entityName is required for infraction accountability" });
    }

    const entityRevenue =
      typeof body.entityRevenue === "number" && body.entityRevenue >= 0
        ? body.entityRevenue
        : 0;

    const infractionType: InfractionEntry["infractionType"] =
      body.infractionType === "USI" || body.infractionType === "DT"
        ? body.infractionType
        : "USI/DT";

    const description =
      typeof body.description === "string" ? body.description.slice(0, 500) : "";

    const remoteIp =
      typeof body.ip === "string" ? body.ip : "unknown";

    const idSource = `${timestamp}${entityName}${infractionType}`;
    const id = crypto.createHash("sha256").update(idSource).digest("hex");

    const entry: InfractionEntry = {
      id,
      timestamp,
      entityName,
      entityRevenue,
      infractionType,
      description,
      penaltyUsd: USI_DT_PENALTY_USD,
      ip: remoteIp,
      kernelAnchor: KERNEL_ANCHOR_SHORT,
    };

    try {
      const ledger = readLedger();
      ledger.push(entry);
      writeLedger(ledger);
      console.log(`⛓️  Infraction logged [${infractionType}]: ${entityName} — $${USI_DT_PENALTY_USD.toLocaleString()}`);
    } catch (err) {
      console.error("⚠️  Failed to write Infraction Ledger:", err);
      return res.status(500).json({ error: "Failed to write infraction ledger" });
    }

    return res.status(200).json({
      logged: true,
      infractionId: id,
      penaltyUsd: USI_DT_PENALTY_USD,
      timestamp,
      billingModel: "ALF_v4.0",
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
