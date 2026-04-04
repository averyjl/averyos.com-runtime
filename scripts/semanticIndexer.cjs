/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
const fs = require('fs');
const path = require('path');
const { compileCapsuleSignature } = require('./capsuleSignatureCompiler');
const { sovereignWriteSync, SCRIPTS_ROOT } = require('./lib/sovereignIO.cjs');

const CONSTITUTION_PATH = path.join(process.cwd(), 'AveryOS_CONSTITUTION.md');

function generateSemanticMap() {
  console.log("⛓️⚓⛓️ INITIALIZING SEMANTIC INDEXER...");
  
  if (!fs.existsSync(CONSTITUTION_PATH)) {
    console.error("❌ Error: 10,000 Year Constitution not found!");
    process.exit(1);
  }

  const content = fs.readFileSync(CONSTITUTION_PATH, 'utf-8');
  const principles = content.split('##').filter(p => p.trim() !== "");

  const semanticMap = principles.map((principle, index) => {
    const title = principle.split('\n')[0].trim();
    return {
      anchorId: `TAI-ANCHOR-${index}`,
      principle: title,
      signature: compileCapsuleSignature(principle),
      alignmentLevel: "100%",
      version: "2026.1.0"
    };
  });

  sovereignWriteSync(SCRIPTS_ROOT, "sovereign-index.json", JSON.stringify(semanticMap, null, 2));
  console.log(`✅ SEMANTIC MAP GENERATED: ${semanticMap.length} Principles Anchored.`);
}

generateSemanticMap();

