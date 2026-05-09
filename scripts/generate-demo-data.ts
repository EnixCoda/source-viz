/**
 * Scans source-viz's own `src/` directory and produces DependencyEntry[] JSON.
 * Run with: npx tsx scripts/generate-demo-data.ts
 *
 * Avoids importing browser-oriented modules (path-browserify) by reimplementing
 * the minimal scanning logic using Node.js native modules.
 */
import * as fs from "fs/promises";
import path from "path";
import { getFiles } from "../src/services/node";
import { prepare as prepareBabelParser } from "../src/services/parsers/babel";
import { defaultIncludes, defaultExcludes } from "../src/components/Scan/filterDefaults";

type Dependency = [dependency: string, isAsync: boolean];
type DependencyEntry = [file: string, Dependency[]];

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.resolve(ROOT_DIR, "src");
const OUT_FILE = path.resolve(ROOT_DIR, "public", "demo-data.json");
const SOURCES_OUT_FILE = path.resolve(ROOT_DIR, "public", "demo-sources.json");

function buildMatcher(patterns: string[]): (p: string) => boolean {
  const regexes = patterns.map((p) => new RegExp(p));
  return (filePath: string) => regexes.some((r) => r.test(filePath));
}

function isRelativePath(p: string): boolean {
  return p.startsWith(".");
}

function resolveRelative(...paths: string[]): string {
  const joined = path.posix.join(...paths);
  if (joined.includes("..")) throw new Error(`Path "${joined}" is lower than root`);
  return joined;
}

function resolveDependency(
  files: Set<string>,
  file: string,
  dep: string,
): string {
  if (!isRelativePath(dep)) return dep;

  const base = resolveRelative(path.posix.dirname(file), dep);
  if (files.has(base)) return base;

  const exts = ["js", "jsx", "mjs", "ts", "tsx", "mts"];
  const withExt = exts.map((e) => base + "." + e).find((p) => files.has(p));
  if (withExt) return withExt;

  const indexFile = exts
    .map((e) => path.posix.join(base, "index." + e))
    .find((p) => files.has(p));
  if (indexFile) return indexFile;

  return base;
}

async function main() {
  const isExcluded = buildMatcher(defaultExcludes);
  const isIncluded = buildMatcher(defaultIncludes);

  const rawFiles = await getFiles(SRC_DIR, isExcluded);
  const files = new Set(rawFiles.map((f) => f.replace(/^\.\//, "")));

  const parse = await prepareBabelParser();

  const entries: DependencyEntry[] = [];
  const sources: Record<string, string> = {};

  for (const file of files) {
    if (!isIncluded(file)) continue;
    try {
      const content = await fs.readFile(path.resolve(SRC_DIR, file), "utf-8");
      const deps = parse(content);
      const resolved: Dependency[] = deps.map(([dep, isAsync]) => [
        resolveDependency(files, file, dep),
        isAsync,
      ]);
      entries.push([file, resolved]);
      sources[file] = content;
    } catch (err) {
      console.warn(`Warning: failed to parse ${file}:`, err);
    }
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(entries), "utf-8");
  await fs.writeFile(SOURCES_OUT_FILE, JSON.stringify(sources), "utf-8");

  console.log(`Demo data generated: ${entries.length} files → ${OUT_FILE}`);
  console.log(`Demo sources generated: ${Object.keys(sources).length} files → ${SOURCES_OUT_FILE}`);
}

main().catch((err) => {
  console.error("Failed to generate demo data:", err);
  process.exit(1);
});
