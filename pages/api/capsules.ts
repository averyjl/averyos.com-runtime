import type { NextApiRequest, NextApiResponse } from "next";
import { listCapsuleIds, loadCapsuleManifest } from "../../lib/capsuleManifest";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const ids = listCapsuleIds();
  const capsules = ids
    .map((capsuleId) => loadCapsuleManifest(capsuleId))
    .filter(Boolean);

  return res.status(200).json({
    count: capsules.length,
    capsules,
  });
};

export default handler;
