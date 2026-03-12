import fs from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const file = req.query.file || 'manifest.json';
  const baseDir = path.resolve('./public/VaultBridge');

  const fullPath = path.join(baseDir, String(file));

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const contents = fs.readFileSync(fullPath, 'utf8');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(contents);
}
