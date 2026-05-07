import * as nodefs from "node:fs/promises";
import * as nodepath from "node:path";
import type { FSLike } from "../src/services/index";

function parseJsonWithComments(content: string): unknown {
  return JSON.parse(content.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""));
}

async function buildResolveAlias(rootDir: string): Promise<((importPath: string) => string | null) | undefined> {
  try {
    const tsconfigPath = nodepath.join(rootDir, "tsconfig.json");
    const content = await nodefs.readFile(tsconfigPath, "utf-8");
    const tsconfig = parseJsonWithComments(content) as { compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string } };
    const { paths, baseUrl } = tsconfig?.compilerOptions ?? {};
    if (!paths) return undefined;
    const base = baseUrl ?? ".";
    const aliases: Array<[string, string]> = Object.entries(paths).map(([alias, [target]]) => [
      alias.replace(/\/\*$/, ""),
      nodepath.posix.join(base, target.replace(/\/\*$/, "")),
    ]);
    return (importPath: string) => {
      for (const [prefix, target] of aliases) {
        if (importPath === prefix || importPath.startsWith(prefix + "/")) {
          return target + importPath.slice(prefix.length);
        }
      }
      return null;
    };
  } catch {
    return undefined;
  }
}

export async function createNodeFs(rootDir: string): Promise<FSLike> {
  const resolveAlias = await buildResolveAlias(rootDir);
  return {
    async readFile(filePath: string): Promise<string> {
      return nodefs.readFile(nodepath.resolve(rootDir, filePath), "utf-8");
    },
    resolvePath(...paths: string[]): string {
      const joined = nodepath.posix.join(...paths);
      if (/\.\./.test(joined)) throw new Error(`Path "${joined}" is lower than root`);
      return joined;
    },
    resolveAlias,
  };
}
