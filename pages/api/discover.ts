import type { NextApiRequest, NextApiResponse } from 'next';
import manifest from '../../VaultBridge/manifest.json';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    capsules: manifest.capsules,
    version: manifest.version,
    mirrors: manifest.mirrors
  });
}
