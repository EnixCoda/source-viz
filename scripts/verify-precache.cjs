#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Sanity check: every cacheable file in dist/ is referenced by the SW precache
// manifest. Helps catch cases where a new asset type slips past globPatterns.
const fs = require("node:fs");
const path = require("node:path");

const dist = path.resolve(__dirname, "..", "dist");
const sw = path.join(dist, "sw.js");

if (!fs.existsSync(sw)) {
  console.error("dist/sw.js not found. Run `pnpm build` first.");
  process.exit(1);
}

const swContent = fs.readFileSync(sw, "utf8");
const urlMatches = swContent.match(/"url":\s*"([^"]+)"/g) || [];
const precachedUrls = new Set(urlMatches.map((m) => m.replace(/"url":\s*"/, "").replace(/"$/, "")));

function walk(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

const cacheableExts = new Set([".js", ".css", ".html", ".wasm", ".json", ".svg", ".png", ".woff2"]);
const skipFiles = new Set(["sw.js", "registerSW.js", "workbox-window.prod.es5.js"]);

const allFiles = walk(dist, []);
const cacheable = allFiles.filter((f) => {
  if (skipFiles.has(path.basename(f))) return false;
  if (path.basename(f).startsWith("workbox-")) return false;
  return cacheableExts.has(path.extname(f));
});

const missing = [];
for (const file of cacheable) {
  const rel = path.relative(dist, file).split(path.sep).join("/");
  // SW manifest urls may or may not have leading slash; both match
  const matched = precachedUrls.has(rel) || precachedUrls.has("/" + rel);
  if (!matched) missing.push(rel);
}

console.log(`Precached entries in sw.js: ${precachedUrls.size}`);
console.log(`Cacheable files in dist/:   ${cacheable.length}`);

if (missing.length > 0) {
  console.error("\n✗ Missing from precache:");
  for (const m of missing) console.error("  - " + m);
  process.exit(1);
}

console.log("\n✓ All cacheable assets are precached. App is fully offline-capable.");
