import type { NextApiRequest, NextApiResponse } from "next";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=120");
  return res.status(200).json({
    status: "stubbed",
    message: "VaultEcho live integrity check is not yet enabled.",
  });
};

export default handler;
