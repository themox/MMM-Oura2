/*
This is an NPM post-install script.

Will be called after the command 'npm install'.

exposes chart.js in a way that the Oura can access it within MM.

Removes the need to go outside the local scripts to the broader Internet to get these files.
*/
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const src = path.join(
  root,
  "node_modules",
  "chart.js",
  "dist",
  "chart.umd.js"
);

const destDir = path.join(root, "vendor");
const dest = path.join(destDir, "chart.umd.js");

if (!fs.existsSync(src)) {
  throw new Error(`Chart.js bundle not found: ${src}`);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log("Copied Chart.js to vendor/chart.umd.js");