/**
 * AnchorWitness Registry — API Route
 * POST /api/witness/register
 *
 * Accepts witness registration submissions (name, email, vaultSig) and
 * commits them to the VaultChain registry at:
 *   capsule_logs/witness_registry.json
 *
 * GET /api/witness/register
 * Returns the current witness registry entries.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import {
  sovereignWriteSync,
  sovereignReadSync,
} from "../../../lib/security/pathSanitizer";

const REGISTRY_FILENAME = "witness_registry.json";

const SHA512_REGEX = /^[a-fA-F0-9]{128}$/;

export interface WitnessEntry {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  vaultSig: string;
}

function readRegistry(): WitnessEntry[] {
  return sovereignReadSync<WitnessEntry[]>(REGISTRY_FILENAME, []);
}

function writeRegistry(entries: WitnessEntry[]): void {
  sovereignWriteSync(REGISTRY_FILENAME, entries);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const registry = readRegistry();
    return res.status(200).json({ count: registry.length, witnesses: registry });
  }

  if (req.method === "POST") {
    const body = req.body ?? {};

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 200)
        : null;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim().slice(0, 200)
        : null;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const vaultSig =
      typeof body.vaultSig === "string" && body.vaultSig.trim()
        ? body.vaultSig.trim()
        : null;

    if (!vaultSig) {
      return res.status(400).json({ error: "vaultSig is required" });
    }

    if (!SHA512_REGEX.test(vaultSig)) {
      return res
        .status(400)
        .json({ error: "vaultSig must be a valid 128-character SHA-512 hex string" });
    }

    const timestamp = new Date().toISOString();
    const id = crypto
      .createHash("sha256")
      .update(`${timestamp}${name}${vaultSig}`)
      .digest("hex");

    const entry: WitnessEntry = { id, timestamp, name, email, vaultSig };

    try {
      const registry = readRegistry();
      registry.push(entry);
      writeRegistry(registry);
      console.log(`⛓️  Witness registered: ${name} — ${id.slice(0, 12)}…`);
    } catch (err) {
      console.error("⚠️  Failed to write witness registry:", err);
      return res.status(500).json({ error: "Failed to write witness registry" });
    }

    return res.status(200).json({ registered: true, witnessId: id, timestamp });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
