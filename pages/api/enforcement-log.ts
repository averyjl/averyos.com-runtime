import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

const logPath = path.join(process.cwd(), "public", "license-enforcement", "logs", "index.json");

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  if (!fs.existsSync(logPath)) {
    return res.status(200).json({ events: [] });
  }

  const payload = JSON.parse(fs.readFileSync(logPath, "utf8"));
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return res.status(200).json(payload);
};

export default handler;
