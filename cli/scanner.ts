import * as nodepath from "node:path";
import { getFiles } from "../src/services/node";
import { prepare as prepareBabelParser } from "../src/services/parsers/babel";
import { prepare as prepareOxcParser } from "../src/services/parsers/oxc";
import { getDependencyEntries } from "../src/services/index";
import { defaultIncludes, defaultExcludes } from "../src/components/Scan/filterDefaults";
import type { DependencyEntry } from "../src/services/serializers";
import { createNodeFs } from "./fs-node";

export interface ScanOptions {
  include?: string[];
  exclude?: string[];
  silent?: boolean;
  parser?: "oxc" | "babel";
}

export interface ScanResult {
  entries: DependencyEntry[];
  /** file → Set of files it imports (relative paths) */
  depMap: Map<string, Set<string>>;
  /** file → Set of files that import it (reverse) */
  dependantMap: Map<string, Set<string>>;
  rootDir: string;
}

export async function scan(dir: string, options: ScanOptions = {}): Promise<ScanResult> {
  const rootDir = nodepath.resolve(dir);
  const includes = options.include ?? defaultIncludes;
  const excludes = options.exclude ?? defaultExcludes;

  const isExcluded = (p: string) => excludes.some((pattern) => new RegExp(pattern).test(p));
  const isIncluded = (p: string) => includes.some((pattern) => new RegExp(pattern).test(p));

  const files = await getFiles(rootDir, isExcluded);
  const fileSet = new Set(files);
  const fs = await createNodeFs(rootDir);
  const parse = await (options.parser === "babel" ? prepareBabelParser() : prepareOxcParser());

  const errors: string[] = [];
  const entries = await getDependencyEntries(fileSet, parse, fs, isIncluded, {
    resolveAllFiles: false,
    onFileError: (file, err) => {
      if (!options.silent) {
        process.stderr.write(`Warning: ${file}: ${err}\n`);
      }
      errors.push(file);
    },
    fallbackParse: options.parser !== "babel" ? () => prepareBabelParser() : undefined,
  });

  const depMap = new Map<string, Set<string>>();
  const dependantMap = new Map<string, Set<string>>();
  for (const [file, deps] of entries) {
    for (const [dep] of deps) {
      if (!depMap.has(file)) depMap.set(file, new Set());
      depMap.get(file)!.add(dep);
      if (!dependantMap.has(dep)) dependantMap.set(dep, new Set());
      dependantMap.get(dep)!.add(file);
    }
  }

  return { entries, depMap, dependantMap, rootDir };
}
