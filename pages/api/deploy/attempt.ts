import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../../scripts/verifyCapsuleHash";
import {
  sovereignWriteSync,
  sovereignReadSync,
} from "../../../lib/security/pathSanitizer";

type AccessLog = {
  createdAt: string;
  vaultToken: string;
  licenseKey: string;
};

const ACCESS_LOG_FILENAME = "license_access.json";

const readAccessLog = (): AccessLog[] => {
  return sovereignReadSync<AccessLog[]>(ACCESS_LOG_FILENAME, []);
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

  sovereignWriteSync(ACCESS_LOG_FILENAME, logs);

  return res.status(200).json({ ok: true });
};

export default handler;
