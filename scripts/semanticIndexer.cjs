const fs = require('fs');
const path = require('path');
const { compileCapsuleSignature } = require('./capsuleSignatureCompiler');

const CONSTITUTION_PATH = path.join(process.cwd(), 'AveryOS_CONSTITUTION.md');
const INDEX_PATH = path.join(process.cwd(), 'scripts', 'sovereign-index.json');

function generateSemanticMap() {
  console.log("⛓️⚓⛓️ INITIALIZING SEMANTIC INDEXER...");

  let content;
  try {
    content = fs.readFileSync(CONSTITUTION_PATH, 'utf-8');
  } catch {
    console.error("❌ Error: 10,000 Year Constitution not found!");
    process.exit(1);
  }
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

  const ifd = fs.openSync(INDEX_PATH, 'w');
  try { fs.writeSync(ifd, JSON.stringify(semanticMap, null, 2)); } finally { fs.closeSync(ifd); }
  console.log(`✅ SEMANTIC MAP GENERATED: ${semanticMap.length} Principles Anchored.`);
}

generateSemanticMap();

