const fs = require("fs");
const path = require("path");
const os = require("os");
const { compileCapsuleSignature } = require("./capsuleSignatureCompiler");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");

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
    const hardwareId = getHardwareId();
    const hash = compileCapsuleSignature(hardwareId);
    console.log("🔍 KERNEL TRUTH REPORT:");
    console.log(`   Machine ID: "${hardwareId}"`);
    console.log(`   Required Key: AVERY-SOV-2026-${hash}`);
    process.exit(1);
  }

  let providedKey = args[keyIndex + 1].toLowerCase();
  const prefix = "avery-sov-2026-";
  if (providedKey.startsWith(prefix)) {
    providedKey = providedKey.replace(prefix, "");
  }

  const hardwareId = getHardwareId();
  const expectedHash = compileCapsuleSignature(hardwareId);

  if (providedKey !== expectedHash) {
    console.error("❌ Auth failed: key does not match hardware signature.");
    process.exit(1);
  }

  const lockData = {
    locked: true,
    timestamp: new Date().toISOString(),
    hardwareSignature: expectedHash,
    node: "Jason-Node-02"
  };

  fs.writeFileSync(SOVEREIGN_LOCK_PATH, JSON.stringify(lockData, null, 2));
  console.log("✅ Sovereign Authentication Successful. .sovereign-lock established.");
}

main();
