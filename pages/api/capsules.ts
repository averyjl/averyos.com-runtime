import type { NextApiRequest, NextApiResponse } from "next";
import { listCapsuleIds, loadCapsuleManifest } from "../../lib/capsuleManifest";
import { loadCapsuleRegistry } from "../../lib/capsuleRegistry";
import { getSiteUrl } from "../../lib/siteConfig";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const registry = loadCapsuleRegistry();
  const ids = listCapsuleIds();
  const capsules = ids
    .map((capsuleId) => loadCapsuleManifest(capsuleId))
    .filter(Boolean);

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return res.status(200).json({
    generatedAt: registry?.generatedAt ?? null,
    count: capsules.length,
    siteUrl: getSiteUrl(),
    capsules,
  });
};

export default handler;
