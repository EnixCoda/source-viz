/**
 * Public API for the usage investigator.
 *
 * Typical usage from React:
 *
 *   const investigator = useMemo(
 *     () => createInvestigator({ fs, knownFiles, dependencyMap, resolveAlias }),
 *     [fs, knownFiles, dependencyMap, resolveAlias],
 *   );
 *
 *   // get exports of a file (lazy parse + cache)
 *   const exports = await investigator.listExports('/src/lib/foo.ts');
 *
 *   // run BFS, streaming hits to the UI
 *   await investigator.investigate({
 *     file: '/src/lib/foo.ts',
 *     symbol: 'foo',
 *     onHit: (h) => setHits((cur) => [...cur, h]),
 *   });
 */
import { analyzeFile, type FileSymbols, type Parser } from "./parseSymbols";
import { buildImporterIndex, expandUsage, type ImporterIndex, type UsageHit } from "./expand";
import { buildPathResolver, InvestigatorFs } from "./fsReader";

export type { FileSymbols, ImportBinding, ReExport, ExportDecl, TopLevelDecl } from "./parseSymbols";
export type { UsageHit, UsageKind, ImporterIndex } from "./expand";
export type { SymbolRef } from "./resolve";

export type CreateInvestigatorOptions = {
  fs: InvestigatorFs;
  /** All file paths known to the dep graph (nodes). */
  knownFiles: Set<string>;
  /** file -> set of files that file depends on. */
  dependencyMap: Map<string, Set<string>>;
  /** Optional alias resolver (tsconfig paths). */
  resolveAlias?: (spec: string) => string | null;
  parse: Parser;
};

export type InvestigateOptions = {
  file: string;
  symbol: string;
  maxHops?: number;
  maxHits?: number;
  onHit?: (hit: UsageHit) => void;
  signal?: AbortSignal;
};

export type Investigator = {
  /** Lazily parse `file` and return its exports (names only). */
  listExports(file: string): Promise<string[]>;
  /** Get full FileSymbols (cached). */
  getSymbols(file: string): Promise<FileSymbols | null>;
  /** Run the BFS from (file, symbol). Returns final list of hits. */
  investigate(opts: InvestigateOptions): Promise<UsageHit[]>;
};

export function createInvestigator(opts: CreateInvestigatorOptions): Investigator {
  const symbolsCache = new Map<string, FileSymbols | null>();
  const importerIndex: ImporterIndex = buildImporterIndex(opts.dependencyMap);
  const resolvePath = buildPathResolver(opts.knownFiles, opts.resolveAlias);

  async function ensureSymbols(file: string): Promise<FileSymbols | null> {
    if (symbolsCache.has(file)) return symbolsCache.get(file)!;
    const src = await opts.fs.readFile(file);
    if (src === null) {
      symbolsCache.set(file, null);
      return null;
    }
    try {
      const sym = analyzeFile(file, src, opts.parse);
      symbolsCache.set(file, sym);
      return sym;
    } catch (err) {
      console.warn(`[investigator] parse failed for ${file}`, err);
      symbolsCache.set(file, null);
      return null;
    }
  }

  return {
    async listExports(file) {
      const sym = await ensureSymbols(file);
      return sym ? sym.exports.map((e) => e.name) : [];
    },
    getSymbols: ensureSymbols,
    async investigate({ file, symbol, maxHops, maxHits, onHit, signal }) {
      // Pre-load all reachable files synchronously inside expandUsage requires
      // a sync loadSymbols. We pre-walk the importer graph from `file` outward,
      // loading each file's source up-front. This is the cost of laziness +
      // sync BFS — acceptable since investigations rarely touch >100 files.
      const toLoad = new Set<string>([file]);
      const queue: string[] = [file];
      while (queue.length > 0) {
        const f = queue.shift()!;
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        await ensureSymbols(f);
        const importers = importerIndex.get(f);
        if (!importers) continue;
        for (const i of importers) {
          if (!toLoad.has(i)) {
            toLoad.add(i);
            queue.push(i);
          }
        }
      }
      const loadSymbols = (f: string) => symbolsCache.get(f) ?? null;
      return expandUsage({
        startFile: file,
        startExport: symbol,
        importerIndex,
        loadSymbols,
        resolvePath,
        maxHops,
        maxHits,
        onHit,
      });
    },
  };
}

export type { InvestigatorFs } from "./fsReader";
export { createDirectoryHandleFs, createMemoryFs } from "./fsReader";
export { analyzeFile } from "./parseSymbols";
