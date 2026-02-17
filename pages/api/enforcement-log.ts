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
    // Read enforcement log
    const logPath = path.join(
      process.cwd(),
      "public",
      "license-enforcement",
      "logs",
      "enforcement-log.json"
    );

    if (!fs.existsSync(logPath)) {
      return res.status(200).json({
        events: [],
        message: "No enforcement events recorded"
      });
    }

    const logContent = fs.readFileSync(logPath, "utf-8");
    const events = JSON.parse(logContent);

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
