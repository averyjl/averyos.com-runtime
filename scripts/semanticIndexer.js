const fs = require('fs');
const path = require('path');
const { compileCapsuleSignature } = require('./capsuleSignatureCompiler');

const CONSTITUTION_PATH = path.join(process.cwd(), 'CONSTITUTION.md');
const INDEX_PATH = path.join(process.cwd(), 'scripts', 'sovereign-index.json');

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

  fs.writeFileSync(INDEX_PATH, JSON.stringify(semanticMap, null, 2));
  console.log(`✅ SEMANTIC MAP GENERATED: ${semanticMap.length} Principles Anchored.`);
}

generateSemanticMap();

