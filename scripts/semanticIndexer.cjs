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

