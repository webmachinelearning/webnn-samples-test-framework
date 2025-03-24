const fs = require("fs");
const path = require("path");

const outDir = path.resolve(__dirname, "..", "out");

try {
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`Successfully removed ${outDir}`);
} catch (error) {
  console.error(`Error removing ${outDir}:`, error);
  process.exit(1);
}
