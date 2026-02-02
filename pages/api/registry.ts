import type { NextApiRequest, NextApiResponse } from "next";
import { loadCapsuleRegistry, listRegistryCapsules } from "../../lib/capsuleRegistry";
import { getSiteUrl } from "../../lib/siteConfig";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const registry = loadCapsuleRegistry();
  const capsules = listRegistryCapsules();

  return res.status(200).json({
    generatedAt: registry?.generatedAt ?? null,
    count: capsules.length,
    siteUrl: getSiteUrl(),
    capsules,
  });
};

export default handler;
