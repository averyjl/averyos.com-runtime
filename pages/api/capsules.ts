import type { NextApiRequest, NextApiResponse } from "next";
import { listCapsuleIds, loadCapsuleManifest } from "../../lib/capsuleManifest";
import { getSiteUrl } from "../../lib/siteConfig";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const ids = listCapsuleIds();
  const capsules = ids
    .map((capsuleId) => loadCapsuleManifest(capsuleId))
    .filter(Boolean);

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return res.status(200).json({
    count: capsules.length,
    capsules,
  });
};

export default handler;
