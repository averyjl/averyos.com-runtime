import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.jsonl");

const hashPrefix = (value: string): string => {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { vaultToken, licenseKey } = req.body ?? {};

  const hasValidToken = typeof vaultToken === "string" && verifyCapsuleHash(vaultToken);
  const hasValidKey = typeof licenseKey === "string" && verifyCapsuleHash(licenseKey);

  if (!hasValidToken && !hasValidKey) {
    return res.status(403).json({
      error: "vaultToken or licenseKey must be a valid SHA512 hash string.",
    });
  }

  // Log only hash prefixes for observability without storing sensitive tokens
  const logEntry = JSON.stringify({
    createdAt: new Date().toISOString(),
    vaultTokenPrefix: typeof vaultToken === "string" ? hashPrefix(vaultToken) : null,
    licenseKeyPrefix: typeof licenseKey === "string" ? hashPrefix(licenseKey) : null,
  }) + "\n";

  fs.mkdirSync(path.dirname(accessLogPath), { recursive: true });
  fs.appendFileSync(accessLogPath, logEntry);

  return res.status(200).json({ ok: true });
};

export default handler;
