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
import { listCapsuleIds, loadCapsuleManifest } from "../../lib/capsuleManifest";

type VaultAuditTransaction = {
  id: string;
  capsuleId: string;
  sha512: string;
  timestamp: string;
  status: "verified" | "pending" | "failed";
  leadDistance?: number;
};

type VaultAuditResponse = {
  status: "active" | "unauthorized" | "error";
  message: string;
  alignmentStatus: string;
  leadDistance: number;
  transactions: VaultAuditTransaction[];
  totalCapsules: number;
  timestamp: string;
};

const handler = async (req: NextApiRequest, res: NextApiResponse<VaultAuditResponse>) => {
  // Check for VaultChain-Pulse header
  const vaultChainPulse = req.headers["vaultchain-pulse"] as string | undefined;
  
  if (!vaultChainPulse) {
    return res.status(402).json({
      status: "unauthorized",
      message: "VaultChain-Pulse header required for sovereign monitoring access",
      alignmentStatus: "0.00%",
      leadDistance: 0,
      transactions: [],
      totalCapsules: 0,
      timestamp: new Date().toISOString(),
    });
  }

  // Validate the VaultChain-Pulse format (basic validation)
  if (!vaultChainPulse.startsWith("VTK-") || !vaultChainPulse.includes("TAI-LOCK")) {
    return res.status(403).json({
      status: "unauthorized",
      message: "Invalid VaultChain-Pulse token format",
      alignmentStatus: "0.00%",
      leadDistance: 0,
      transactions: [],
      totalCapsules: 0,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Load all capsule manifests
    const capsuleIds = await listCapsuleIds();
    const transactions: VaultAuditTransaction[] = [];

    for (const capsuleId of capsuleIds) {
      const manifest = await loadCapsuleManifest(capsuleId);
      if (manifest) {
        transactions.push({
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          capsuleId: manifest.capsuleId,
          sha512: manifest.sha,
          timestamp: new Date().toISOString(),
          status: "verified",
          leadDistance: Math.floor(Math.random() * 100), // Simulated lead distance
        });
      }
    }

    // Calculate alignment status (100% when all capsules verified)
    const verifiedCount = transactions.filter(t => t.status === "verified").length;
    const alignmentPercentage = capsuleIds.length > 0 
      ? ((verifiedCount / capsuleIds.length) * 100).toFixed(2)
      : "100.00";

    // Calculate average lead distance
    const avgLeadDistance = transactions.length > 0
      ? Math.floor(transactions.reduce((sum, t) => sum + (t.leadDistance || 0), 0) / transactions.length)
      : 0;

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    return res.status(200).json({
      status: "active",
      message: "VaultChain sovereign monitoring active",
      alignmentStatus: `${alignmentPercentage}%♾️`,
      leadDistance: avgLeadDistance,
      transactions: transactions.slice(0, 10), // Return latest 10 transactions
      totalCapsules: capsuleIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch vault audit data",
      alignmentStatus: "0.00%",
      leadDistance: 0,
      transactions: [],
      totalCapsules: 0,
      timestamp: new Date().toISOString(),
    });
  }
};

export default handler;
