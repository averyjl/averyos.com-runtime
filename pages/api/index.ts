import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const file = req.query.file || 'manifest.json';
  const baseDir = path.resolve('./public/VaultBridge');

  const fullPath = path.join(baseDir, file);

  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const contents = fs.readFileSync(fullPath, 'utf8');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(contents);
}
