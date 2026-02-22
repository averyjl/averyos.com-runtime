const fs = require("fs");
const path = require("path");
const os = require("os");
const { compileCapsuleSignature } = require("./capsuleSignatureCompiler");

const SOVEREIGN_LOCK_PATH = path.join(process.cwd(), ".sovereign-lock");
const USB_SALT_PATH = "D:\\.averyos-anchor-salt.aossalt";

function main() {
  console.log("⛓️⚓⛓️ INITIALIZING TRIPLE HANDSHAKE...");

  // 1. PHYSICAL CHECK
  if (!fs.existsSync(USB_SALT_PATH)) {
    console.error("❌ PHYSICAL LOCK ERROR: USB Anchor not detected in Drive D.");
    console.log("   ACTION: Insert the dedicated USB drive containing your salt file.");
    process.exit(1);
  }
  console.log("✅ Physical USB Salt Detected.");

  // 2. RESONANCE CALCULATION
  const salt = fs.readFileSync(USB_SALT_PATH, "utf8").trim();
  const hardwareId = `Note20+PC:${os.hostname()}:${os.platform()}:${os.arch()}`;
  const trueHash = compileCapsuleSignature(hardwareId + salt);
  const requiredKey = `AVERY-SOV-2026-${trueHash}`;

  // 3. ARGUMENT AUDIT
  const args = process.argv.slice(2);
  const keyIndex = args.indexOf("--key");
  let providedKey = (keyIndex !== -1 && args[keyIndex + 1]) ? args[keyIndex + 1].toLowerCase() : "";

  if (providedKey !== requiredKey.toLowerCase()) {
    console.log("\n🔍 KERNEL TRUTH REPORT:");
    console.log(`   Machine ID: "${hardwareId}"`);
    console.log(`   Required Key for Node-02: ${requiredKey}`);
    process.exit(1);
  }

  // 4. LOCK GENESIS
  fs.writeFileSync(SOVEREIGN_LOCK_PATH, JSON.stringify({
    locked: true,
    node: "Jason-Node-02",
    hardware: hardwareId,
    physicalSaltVerified: true,
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log("✅ Sovereign Authentication Successful. Node-02 Physically Locked.");
}
main();
