const fs = require("fs");
const path = require("path");

const targetDir = process.argv[2];
if (!targetDir) {
  console.error("Usage: node scripts/sync-assets.js <targetDir>");
  process.exit(1);
}

const root = process.cwd();
const dest = path.join(root, targetDir);
const files = ["index.html", "styles.css", "app.js"];

fs.mkdirSync(dest, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dest, file));
}

console.log(`Synced ${files.length} files to ${targetDir}`);
