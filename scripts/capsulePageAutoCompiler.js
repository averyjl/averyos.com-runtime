const fs = require("fs");
const path = require("path");

const capsulesDir = path.join(__dirname, "..", "capsules");
const outputDir = path.join(__dirname, "..", "public", "capsule-registry");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function compileCapsule(fileName) {
  const filePath = path.join(capsulesDir, fileName);
  let capsuleData;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    capsuleData = JSON.parse(raw);
  } catch (err) {
    console.warn(`⚠️ Skipping non-JSON or invalid capsule: ${fileName}`);
    return null;
  }

  // Example output format: customize as needed
  const outputFile = path.join(outputDir, `${capsuleData.capsuleId || fileName}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(capsuleData, null, 2));
  return outputFile;
}

function run() {
  const files = fs.readdirSync(capsulesDir).filter(file => file.endsWith(".aoscap"));
  const results = files.map(compileCapsule).filter(Boolean);
  console.log(`✅ Compiled ${results.length} capsule manifest(s).`);
}

run();
