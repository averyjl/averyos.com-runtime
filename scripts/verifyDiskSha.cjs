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
