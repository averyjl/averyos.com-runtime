/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
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
import fs from "fs";
import path from "path";
import crypto from "crypto";

const WITNESS_REGISTRY_PATH = path.join(
  process.cwd(),
  "capsule_logs",
  "witness_registry.json"
);

const SHA512_REGEX = /^[a-fA-F0-9]{128}$/;

export interface WitnessEntry {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  vaultSig: string;
}

function readRegistry(): WitnessEntry[] {
  const dir = path.dirname(WITNESS_REGISTRY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(WITNESS_REGISTRY_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(WITNESS_REGISTRY_PATH, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeRegistry(entries: WitnessEntry[]): void {
  const dir = path.dirname(WITNESS_REGISTRY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WITNESS_REGISTRY_PATH, JSON.stringify(entries, null, 2));
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
      const safeName = name.replace(/[\r\n]/g, "");
      console.log(`⛓️  Witness registered: ${safeName} — ${id.slice(0, 12)}…`);
    } catch (err) {
      console.error("⚠️  Failed to write witness registry:", err);
      return res.status(500).json({ error: "Failed to write witness registry" });
    }

    return res.status(200).json({ registered: true, witnessId: id, timestamp });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
