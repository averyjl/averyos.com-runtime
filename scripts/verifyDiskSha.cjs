/**
 * AveryOS™ Physical-File SHA Validator
 * Standard: Zero-Inference / Zero-Trust Disk Audit
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const targetFile = process.argv[2];
const expectedSha = process.argv[3];

if (!targetFile) {
  console.error("❌ ERROR: No target file specified.");
  process.exit(1);
}

try {
  const fileBuffer = fs.readFileSync(path.resolve(targetFile));
  const hashSum = crypto.createHash('sha512');
  hashSum.update(fileBuffer);
  const hex = hashSum.digest('hex');

  console.log(`\n⛓️⚓⛓️ AveryOS™ Disk Audit`);
  console.log(`File: ${targetFile}`);
  console.log(`Physical SHA-512: ${hex}`);

  if (expectedSha) {
    if (hex === expectedSha) {
      console.log(`✅ VERIFIED: Physical match with GroundTruth bedrock.`);
    } else {
      console.log(`❌ DRIFT DETECTED: Physical SHA does not match expectation.`);
      process.exit(1);
    }
  }
} catch (err) {
  console.error(`❌ SYSTEM ERROR: ${err.message}`);
  process.exit(1);
}
