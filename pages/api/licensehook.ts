import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCapsuleHash } from "../../scripts/verifyCapsuleHash";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }


  const sigHeader = req.headers["x-vaultsig"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  if (sig && !verifyCapsuleHash(sig)) {
    return res.status(400).json({ error: "Invalid VaultSig header (expected SHA512 hash)." });
  }

  const { capsuleId, licenseId, status } = req.body ?? {};

  if (!capsuleId || !licenseId || !status) {
    return res.status(400).json({ error: "Missing capsuleId, licenseId, or status" });
  }

  return res.status(200).json({
    received: true,
    capsuleId,
    licenseId,
    status,
    timestamp: new Date().toISOString(),
  });
};

export default handler;
