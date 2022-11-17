import { Entry } from "./serialize.map";

export type MetaFilter = {
  includes: string[];
  excludes: string[];
};

export function entriesToPreparedData(map: Entry[]): string[][] {
  return map
    .map(([key, value]) => value.map(([dependency, dynamicImport]) => [key, dependency, `${dynamicImport}`]))
    .flat();
}

type Parse = (source: string) => [string, boolean][];

export interface FSLike {
  readFile(path: string): string | Promise<string>;
  resolvePath(...paths: string[]): string;
}

export const deps = async function (
  files: string[],
  parse: Parse,
  fs: FSLike,
  isIncluded?: (path: string) => boolean,
  resolveAllFiles: boolean = false,
  {
    reportProgress,
    onError,
  }: {
    reportProgress?: (file: string, progress: number) => void;
    onError?: (file: string, error: unknown) => void;
  } = {}
) {
  const dependencyMap = new Map<string, [string, boolean][]>([
    /**
     * Format: [file_path, [dependency, async import]]
     *
     * ['src/index.js', ['axios', false]]
     * ['src/index.js', ['src/app.js', true]]
     * */
  ]);

  let process = 0;
  for (const file of files) {
    if (!isIncluded?.(file)) continue;
    const content = await fs.readFile(file);
    try {
      const dependencies = parse(content);
      dependencyMap.set(file, dependencies);
    } catch (err) {
      if (onError) {
        onError(file, err);
      } else {
        console.error(`Error parsing "${file}", throwing because no \`onError\` handler provided`);
        throw err;
      }
    }
    reportProgress?.(file, ++process);
  }

  function resolveDependencyFile(file: string, importPath: string) {
    // Relative:
    //    ./
    //    ../
    // Absolute:
    //    path
    //    path/to/file
    //    /path/to/file
    const isRelative = importPath.startsWith(".");
    // TODO: handle path alias
    if (!isRelative) return importPath;

    const baseResolved = fs.resolvePath(file, "..", importPath);
    // NodeJS-like resolve strategy:
    // "original" -->
    // 1. "original"
    // 2. "original.js", here also resolve ".tsx?" files
    // 3. "original/index.js"

    // 1.
    if (files.includes(baseResolved)) return baseResolved;
    // 2.
    const exts = ["js", "jsx", "ts", "tsx"];
    const withExt = exts.map((ext) => baseResolved + "." + ext).find((withExt) => files.includes(withExt));
    if (withExt) return withExt;
    // 3.
    const indexFile = exts
      .map((ext) => fs.resolvePath(baseResolved, "index." + ext))
      .find((indexFile) => files.includes(indexFile));
    if (indexFile) return indexFile;

    if (resolveAllFiles) throw new Error(`Dependency "${importPath}" cannot be resolved from "${file}"`);

    return baseResolved;
  }

  const entries: Entry[] = [...dependencyMap.entries()].map(([file, dependencies]) => [
    file,
    dependencies.map(
      ([dependency, dynamicImport]) => [resolveDependencyFile(file, dependency), dynamicImport] as [string, boolean]
    ),
  ]);

  return entries;
};
