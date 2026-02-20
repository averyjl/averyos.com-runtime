#!/usr/bin/env node

// ⛓️⚓⛓️ Sovereign Auth
// Accepts --key <sha512-signature>, verifies it against the SHA-512 of the
// hardware ID (Note20 + PC), and if it matches writes a .sovereign-lock file
// to the project root.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { compileCapsuleSignature } = require("./capsuleSignatureCompiler");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");

// Stable hardware identifier anchored to the Note20 + PC device pair.
function getHardwareId() {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  return `Note20+PC:${hostname}:${platform}:${arch}`;
}

function main() {
  const args = process.argv.slice(2);
  const keyIndex = args.indexOf("--key");

  if (keyIndex === -1 || !args[keyIndex + 1]) {
    console.error("Usage: node auth.js --key <sha512-signature>");
    process.exit(1);
  }

  const providedKey = args[keyIndex + 1].toLowerCase();
  const hardwareId = getHardwareId();
  const expectedKey = compileCapsuleSignature(hardwareId);

  if (providedKey !== expectedKey) {
    console.error("❌ Auth failed: key does not match hardware signature.");
    process.exit(1);
  }

  const lockData = {
    locked: true,
    timestamp: new Date().toISOString(),
    hardwareSignature: expectedKey,
    hardwareId,
  };

  fs.writeFileSync(SOVEREIGN_LOCK_PATH, JSON.stringify(lockData, null, 2));
  console.log("✅ Sovereign lock established:", SOVEREIGN_LOCK_PATH);
}

main();
