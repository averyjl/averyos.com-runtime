import type { NextApiRequest, NextApiResponse } from "next";
import { loadCapsuleRegistry, listRegistryCapsules } from "../../lib/capsuleRegistry";
import { getSiteUrl } from "../../lib/siteConfig";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const registry = loadCapsuleRegistry();
  const capsules = listRegistryCapsules();

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return res.status(200).json({
    generatedAt: registry?.generatedAt ?? null,
    count: capsules.length,
    siteUrl: getSiteUrl(),
    capsules,
  });
};

export default handler;
