import { existsSync, promises as fs } from "fs";
import path from "path";
import yargs from "yargs";
import * as babelParser from "./parsers/babel";
import { stringifyToCSV } from "./serialize.csv";

const exclude = new Set<string>(["node_modules", "bower_components", "build", "dist"]);

async function scanFiles(dir: string, parse: Parse) {
  const items = await fs.readdir(dir);
  for (const item of items) {
    if (exclude.has(item)) continue;
    const itemPath = path.join(dir, item);
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await scanFiles(itemPath, parse);
    } else {
      await scan(itemPath, parse);
    }
  }
}

const dependencyMap = new Map<string, [string, boolean][]>([
  /**
   * Format: [file_path, [dependency, async import]]
   *
   * ['src/index.js', ['axios', false]]
   * ['src/index.js', ['src/app.js', true]]
   * */
]);

type Parse = (source: string) => [string, boolean][];

async function scan(file: string, parse: Parse) {
  try {
    if (!file.endsWith(".js")) return;
    const source = await fs.readFile(file, "utf8");
    const dependencies = parse(source);
    dependencyMap.set(file, dependencies);
  } catch (err) {
    console.error(`Error in "${file}"`);
    throw err;
  }
}

async function main() {
  const {
    rootDir,
    module,
    output: outputCSVFile = path.join(process.cwd(), "out.csv"),
    outputJSONFile = path.join(process.cwd(), "out.json"),
  } = await yargs.argv;

  if (!module) {
    throw new Error("Please specify a module");
  }

  if (typeof rootDir !== "string") {
    throw new Error("Please specify a root directory");
  }

  if (typeof outputCSVFile !== "string") {
    throw new Error("Please specify a output file");
  }

  await scanFiles(rootDir, babelParser.parse);

  const dependents = new Set([...dependencyMap.entries()].flat());
  function resolveDependencyFile(file: string, importPath: string) {
    // Relative:
    //    ./
    //    ../
    // Absolute:
    //    path
    //    path/to/file
    //    /path/to/file
    const isRelative = importPath.startsWith(".");
    if (!isRelative) return importPath;

    const baseResolved = path.resolve(file, "..", importPath);
    // NodeJS-like resolve strategy:
    // "original" -->
    // 1. "original"
    // 2. "original.js"
    // 3. "original/index.js"
    if (dependents.has(baseResolved)) return baseResolved;
    if (dependents.has(baseResolved + ".js")) return baseResolved + ".js";
    if (dependents.has(path.resolve(baseResolved, "index.js"))) return path.resolve(baseResolved, "index.js");
    try {
      if (existsSync(baseResolved)) return baseResolved;
    } catch (e) {}

    throw new Error(`Dependency "${importPath}" cannot be resolved`);
  }

  const entries = [...dependencyMap.entries()].map(
    ([file, dependencies]) =>
      [
        wipeRootFolder(file, rootDir),
        dependencies
          .map(([dependency, dynamicImport]) => [resolveDependencyFile(file, dependency), dynamicImport] as const)
          .map(([dependency, dynamicImport]) => [wipeRootFolder(dependency, rootDir), dynamicImport] as const),
      ] as const
  );

  await fs.writeFile(outputCSVFile, stringifyMapToCSV(["File", "Dependency", "DynamicImport"], entries));

  await fs.writeFile(outputJSONFile as string, stringifyMapToJSON(entries));
}

function wipeRootFolder(file: string, rootDir: string): string {
  return file.startsWith(rootDir) ? file.replace(rootDir, "") : file;
}

const stringifyMapToCSV = (titles: string[], map: (readonly [string, (readonly [string, boolean])[]])[]) =>
  stringifyToCSV([
    titles,
    map
      .map(([key, value]) => value.map(([dependency, dynamicImport]) => [key, dependency, `${dynamicImport}`]))
      .flat()
      .flat(),
  ]);

const stringifyMapToJSON = (records: (readonly [string, (readonly [string, boolean])[]])[]) =>
  JSON.stringify(
    records
      .map(([key, value]) => value.map(([dependency, dynamicImport]) => [key, dependency, `${dynamicImport}`]))
      .flat()
  );

main();
