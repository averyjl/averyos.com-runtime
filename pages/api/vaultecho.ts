import type { NextApiRequest, NextApiResponse } from "next";
import { validateVaultSigHash } from "../../lib/capsuleUtils";
import { listCapsuleIds, loadCapsuleManifest } from "../../lib/capsuleManifest";

type VaultEchoResponse = {
  status: "active" | "error";
  message: string;
  capsuleId?: string;
  hashValid?: boolean;
  hashMatch?: boolean;
  timestamp: string;
};

const handler = async (req: NextApiRequest, res: NextApiResponse<VaultEchoResponse>) => {
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=120");

  const { hash, capsuleId } = req.query;

  // If hash is provided, validate it
  if (hash && typeof hash === "string") {
    const isValid = validateVaultSigHash(hash);
    
    if (!isValid) {
      return res.status(400).json({
        status: "error",
        message: "Invalid SHA-512 hash format. Expected 128 hexadecimal characters.",
        hashValid: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if hash matches any known capsule
    const normalizedHash = hash.trim().toLowerCase();
    const capsuleIds = listCapsuleIds();
    let matchedCapsule: string | null = null;

    for (const id of capsuleIds) {
      const manifest = loadCapsuleManifest(id);
      if (manifest && manifest.sha.toLowerCase() === normalizedHash) {
        matchedCapsule = id;
        break;
      }
    }

    if (matchedCapsule) {
      return res.status(200).json({
        status: "active",
        message: "Hash verified and matched to known capsule.",
        capsuleId: matchedCapsule,
        hashValid: true,
        hashMatch: true,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: "active",
      message: "Hash format valid but no matching capsule found in registry.",
      hashValid: true,
      hashMatch: false,
      timestamp: new Date().toISOString(),
    });
  }

  // If capsuleId is provided, check if it exists
  if (capsuleId && typeof capsuleId === "string") {
    const manifest = loadCapsuleManifest(capsuleId);
    
    if (manifest) {
      return res.status(200).json({
        status: "active",
        message: `Capsule '${capsuleId}' found in registry.`,
        capsuleId,
        hashValid: validateVaultSigHash(manifest.sha),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(404).json({
      status: "error",
      message: `Capsule '${capsuleId}' not found in registry.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Default response - system status
  const capsuleCount = listCapsuleIds().length;
  return res.status(200).json({
    status: "active",
    message: `VaultEcho integrity telemetry is active. Monitoring ${capsuleCount} capsule(s).`,
    timestamp: new Date().toISOString(),
  });
};

export default handler;
