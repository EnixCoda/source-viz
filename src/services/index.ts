import * as babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import { existsSync, promises as fs } from "fs";
import path from "path";
import yargs from "yargs";
import { stringifyToCSV } from "./serialize.csv";

const exclude = new Set<string>(["node_modules", "bower_components", "build", "dist"]);

async function scanFiles(dir: string, scan: (file: string) => Promise<void>) {
  const items = await fs.readdir(dir);
  for (const item of items) {
    if (exclude.has(item)) continue;
    const itemPath = path.join(dir, item);
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await scanFiles(itemPath, scan);
    } else {
      await scan(itemPath);
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
async function scan(file: string) {
  try {
    if (!file.endsWith(".js")) return;
    const source = await fs.readFile(file, "utf8");
    const dependencies = parseWithBabel(source);
    dependencyMap.set(file, dependencies);
  } catch (err) {
    console.error(`Error in "${file}"`);
    throw err;
  }
}

function parseWithBabel(source: string) {
  const ast = babelParser.parse(source, {
    sourceType: "module",
    attachComment: false,
    plugins: [
      "jsx",
      "classProperties",
      "objectRestSpread",
      "optionalChaining",
      "nullishCoalescingOperator",
      "dynamicImport",
    ],
  });
  const dependencies: [string, boolean][] = [];
  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      const { source } = node;
      const { value: dependency } = source;
      dependencies.push([dependency, false]);
    }
  }
  // TODO: find `import()` statements
  const shouldScanDynamicImport = source.includes("import(");
  if (shouldScanDynamicImport) {
    // extract `import()` statements
    traverse(ast, {
      Import: (nodePath) => {
        const { parent } = nodePath;
        if (parent.type === "CallExpression") {
          const importTargetNode = parent.arguments[0];
          if (importTargetNode.type === "StringLiteral") {
            const dependency = importTargetNode.value;
            dependencies.push([dependency, true]);
          } else if (importTargetNode.type === "TemplateLiteral") {
            for (const node of importTargetNode.quasis) {
              const dependency = node.value.cooked || node.value.raw;
              dependencies.push([dependency, true]);
            }
          } else {
            throw new Error(`${importTargetNode.type} is not a string`);
          }
        } else {
          throw new Error(`Unexpected parent type "${parent.type}"`);
        }
      },
    });
    // parse extracted statements
    // extract dependencies
  }
  return dependencies;
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

  await scanFiles(rootDir, scan);

  const dependants = new Set([...dependencyMap.entries()].flat());
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
    if (dependants.has(baseResolved)) return baseResolved;
    if (dependants.has(baseResolved + ".js")) return baseResolved + ".js";
    if (dependants.has(path.resolve(baseResolved, "index.js"))) return path.resolve(baseResolved, "index.js");
    try {
      if (existsSync(baseResolved)) return baseResolved;
    } catch (e) {}

    throw new Error(`Dependency "${importPath}" cannot be resolved`);
  }

  const entries = [...dependencyMap.entries()]
    .map(
      ([file, dependencies]) =>
        [
          wipeRootFolder(file, rootDir),
          dependencies
            .map(([dependency, dynamicImport]) => [resolveDependencyFile(file, dependency), dynamicImport] as const)
            .map(([dependency, dynamicImport]) => [wipeRootFolder(dependency, rootDir), dynamicImport] as const),
        ] as const
    )
    .map(
      ([file, dependencies]) =>
        [
          encode(file),
          dependencies.map(([dependency, dynamicImport]) => [encode(dependency), dynamicImport] as const),
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

// encode
function encode(str: string): string {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}
