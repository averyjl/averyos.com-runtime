import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

type DeployStatus = {
  status: "active" | "pending" | "failed";
  lastDeploy?: string;
  version?: string;
};

/**
 * Deploy status endpoint
 * Returns the current deployment status
 * Optionally validates admin access using VAULTSIG_SECRET
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Check for admin authorization if VAULTSIG_SECRET is configured
  const expectedSecret = process.env.VAULTSIG_SECRET;
  const providedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  let isAdmin = false;
  
  if (expectedSecret && providedSecret) {
    try {
      // Use timing-safe comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(expectedSecret, "utf-8");
      const providedBuffer = Buffer.from(providedSecret, "utf-8");
      
      // Only compare if lengths match (prevents timing attacks on length)
      if (expectedBuffer.length === providedBuffer.length) {
        isAdmin = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
      }
    } catch (err) {
      // Comparison failed, isAdmin remains false
      console.error("Secret comparison error:", err);
    }
  }

  // Basic status information (public)
  const statusInfo: DeployStatus = {
    status: "active",
    lastDeploy: new Date().toISOString(),
  };

  // Additional information for authenticated admins
  if (isAdmin) {
    statusInfo.version = process.env.npm_package_version || "unknown";
  }

  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
  return res.status(200).json(statusInfo);
};

export default handler;
