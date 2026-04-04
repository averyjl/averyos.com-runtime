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
 * Public API endpoint for license enforcement logs
 * Returns transparent, SHA-verified enforcement events
 * Focus: Voluntary compliance tracking and licensing offers
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read enforcement log — use try/catch instead of existsSync to avoid TOCTOU.
    const logPath = path.join(
      process.cwd(),
      "public",
      "license-enforcement",
      "logs",
      "enforcement-log.json"
    );

    let events: unknown;
    try {
      const logContent = fs.readFileSync(logPath, "utf-8");
      events = JSON.parse(logContent);
    } catch {
      return res.status(200).json({
        events: [],
        message: "No enforcement events recorded"
      });
    }

    return res.status(200).json({
      events,
      meta: {
        purpose: "voluntary_license_compliance_tracking",
        transparency: "all_events_publicly_viewable",
        enforcement_type: "informational_only",
        legal_status: "no_automated_legal_action"
      }
    });
  } catch (error) {
    console.error("Error reading enforcement log:", error);
    return res.status(500).json({ error: "Failed to read enforcement log" });
  }
}
