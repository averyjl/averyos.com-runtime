/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

const accessLogPath = path.join(process.cwd(), "capsule_logs", "license_access.json");

const readAccessLog = (): AccessLog[] => {
  if (!fs.existsSync(accessLogPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(accessLogPath, "utf8")) as AccessLog[];
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { vaultToken, licenseKey } = req.body ?? {};

  if (!verifyCapsuleHash(vaultToken) && !verifyCapsuleHash(licenseKey)) {
    return res.status(403).json({
      error: "VaultToken or license key must be a valid SHA512 hash.",
    });
  }

  const logs = readAccessLog();
  logs.push({
    createdAt: new Date().toISOString(),
    vaultToken: typeof vaultToken === "string" ? vaultToken : "",
    licenseKey: typeof licenseKey === "string" ? licenseKey : "",
  });

  fs.mkdirSync(path.dirname(accessLogPath), { recursive: true });
  fs.writeFileSync(accessLogPath, JSON.stringify(logs, null, 2));

  return res.status(200).json({ ok: true });
};

export default handler;
