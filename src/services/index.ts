import { isRelativePath } from "../utils/path";
import { DependencyEntry, DependencyMap } from "./serializers";

export type MetaFilter = {
  includes: string[];
  excludes: string[];
};

type Parse = (source: string) => [string, boolean][];

export interface FSLike {
  readFile(path: string): string | Promise<string>;
  resolvePath(...paths: string[]): string;
}

export async function getDependencyEntries(
  files: Set<string>,
  parse: Parse,
  fs: FSLike,
  isIncluded?: (path: string) => boolean,
  {
    resolveAllFiles = false,
    onFileParsed,
    onFileError,
  }: {
    resolveAllFiles?: boolean;
    onFileParsed?: (file: string) => void;
    onFileError?: (file: string, error: unknown) => void;
  } = {},
) {
  const dependencyMap: DependencyMap = new Map([
    /**
     * Format: [file_path, [dependency, async import]]
     *
     * ['src/index.js', ['axios', false]]
     * ['src/index.js', ['src/app.js', true]]
     * */
  ]);

  for (const file of files) {
    if (!isIncluded?.(file)) continue;
    try {
      const content = await fs.readFile(file);
      const dependencies = parse(content);
      dependencyMap.set(file, dependencies);
    } catch (err) {
      if (onFileError) {
        onFileError(file, err);
      } else {
        console.error(`Error parsing "${file}", throwing because no \`onError\` handler provided`);
        throw err;
      }
    }
    onFileParsed?.(file);
  }

  const entries: DependencyEntry[] = [...dependencyMap.entries()].map(([file, dependencies]) => [
    file,
    dependencies.map(
      ([dependency, dynamicImport]) =>
        [resolveDependencyFile(fs, files, file, dependency, resolveAllFiles), dynamicImport] as [string, boolean],
    ),
  ]);

  return entries;
}

function resolveDependencyFile(
  fs: FSLike,
  files: Set<string>,
  file: string,
  dependencyRef: string,
  resolveAllFiles: boolean,
) {
  // TODO: handle path alias

  if (!isRelativePath(dependencyRef)) return dependencyRef;

  const baseResolved = fs.resolvePath(file, "..", dependencyRef);
  // NodeJS-like resolve strategy:
  // "original" -->
  // 1. "original"
  // 2. "original.js", here also resolve ".tsx?" files
  // 3. "original/index.js"

  // 1.
  if (files.has(baseResolved)) return baseResolved;
  // 2.
  const exts = ["js", "jsx", "mjs", "ts", "tsx", "mts"];
  const withExt = exts.map((ext) => baseResolved + "." + ext).find((withExt) => files.has(withExt));
  if (withExt) return withExt;
  // 3.
  const indexFile = exts
    .map((ext) => fs.resolvePath(baseResolved, "index." + ext))
    .find((indexFile) => files.has(indexFile));
  if (indexFile) return indexFile;

  if (resolveAllFiles) throw new Error(`Dependency "${dependencyRef}" cannot be resolved from "${file}"`);

  return baseResolved;
}
