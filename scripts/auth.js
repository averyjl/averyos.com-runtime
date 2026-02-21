const fs = require("fs");
const path = require("path");
const os = require("os");
const { compileCapsuleSignature } = require("./capsuleSignatureCompiler");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const USB_SALT_PATH = "D:\\.averyos-anchor-salt.aossalt";

function getHardwareId() {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  return `Note20+PC:${hostname}:${platform}:${arch}`;
}

function main() {
  console.log("⛓️⚓⛓️ INITIALIZING TRIPLE HANDSHAKE...");

  // 1. Physical USB Check
  if (!fs.existsSync(USB_SALT_PATH)) {
    console.error("❌ PHYSICAL LOCK ERROR: USB Anchor not detected in Drive D.");
    console.error("Please insert your dedicated AveryOS physical salt drive.");
    process.exit(1);
  }

  // 2. Hardware Resonance
  const salt = fs.readFileSync(USB_SALT_PATH, "utf8").trim();
  const hardwareId = getHardwareId();
  const trueHash = compileCapsuleSignature(hardwareId + salt);
  const requiredKey = `AVERY-SOV-2026-${trueHash}`;

  const args = process.argv.slice(2);
  const keyIndex = args.indexOf("--key");
  let providedKey = (keyIndex !== -1 && args[keyIndex + 1]) ? args[keyIndex + 1].toLowerCase() : "";

  // 3. Creator Key Verification
  if (!providedKey || providedKey !== requiredKey.toLowerCase()) {
    console.log("\n🔍 KERNEL TRUTH REPORT:");
    console.log(`   Machine ID: "${hardwareId}"`);
    console.log(`   Required Key for Node-02: ${requiredKey}`);
    process.exit(1);
  }

  const lockData = {
    locked: true,
    node: "Jason-Node-02",
    hardware: hardwareId,
    saltVerified: true,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(SOVEREIGN_LOCK_PATH, JSON.stringify(lockData, null, 2));
  console.log("\n✅ Sovereign Authentication Successful. Node-02 Physically Locked.");
}

main();
