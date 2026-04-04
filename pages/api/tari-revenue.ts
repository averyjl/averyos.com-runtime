/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

/**
 * TARI Revenue API
 * Computes real-time 24-hour Liquid Liability from AveryOS AI Gateway logs.
 * Pricing mirrors generateInvoices.cjs: $10,000 (Base BSU) + $1.00 per request per corporate org.
 */

const LOG_PATH = path.join(process.cwd(), "capsule_logs", "ai_gateway_logs.json");
const BASE_BSU_USD = 10_000;
const PER_REQUEST_USD = 1.00;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type GatewayLogEntry = {
  timestamp: string;
  ip?: string;
  sig?: string | null;
  reason?: string;
  org_id?: string;
  orgId?: string;
  request_count?: number;
  requestCount?: number;
};

type TariRevenueResponse = {
  totalUsd: string;
  requestCount: number;
  orgCount: number;
  windowHours: number;
  timestamp: string;
  source: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<TariRevenueResponse>
) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  let logs: GatewayLogEntry[] = [];
  try {
    const raw = fs.readFileSync(LOG_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    logs = Array.isArray(parsed) ? (parsed as GatewayLogEntry[]) : [];
  } catch {
    logs = [];
  }

  // Filter to 24-hour window; skip entries without a parseable timestamp
  const cutoff = Date.now() - WINDOW_MS;
  const recent = logs.filter((e) => {
    if (!e.timestamp) return false;
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && t >= cutoff;
  });

  // Aggregate by org_id for corporate entries; treat non-org entries as individual units
  const orgMap = new Map<string, number>();
  let nonOrgCount = 0;

  for (const entry of recent) {
    const orgId = entry.org_id || entry.orgId || null;
    const count = Number(entry.request_count ?? entry.requestCount ?? 1);
    if (orgId) {
      orgMap.set(orgId, (orgMap.get(orgId) ?? 0) + count);
    } else {
      nonOrgCount += count;
    }
  }

  // Compute total: each corporate org pays BASE_BSU + per-request fee
  let totalUsd = 0;
  let totalRequests = nonOrgCount;
  for (const [, count] of orgMap) {
    totalUsd += BASE_BSU_USD + count * PER_REQUEST_USD;
    totalRequests += count;
  }
  // Non-org entries contribute per-request fee only
  totalUsd += nonOrgCount * PER_REQUEST_USD;

  res.status(200).json({
    totalUsd: totalUsd.toFixed(2),
    requestCount: totalRequests,
    orgCount: orgMap.size,
    windowHours: 24,
    timestamp: new Date().toISOString(),
    source: "ai_gateway_logs",
  });
}
