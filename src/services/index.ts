import { isRelativePath } from "../utils/path";
import { AdaptivePool, Budget, Pool } from "./pool";
import { Dependency, DependencyEntry, DependencyKind } from "./serializers";

export type MetaFilter = {
  includes: string[];
  excludes: string[];
};

type Parse = (source: string) => [string, boolean][] | Promise<[string, boolean][]>;

export interface FSLike {
  readFile(path: string): string | Promise<string>;
  resolvePath(...paths: string[]): string;
  /** Optional: resolve a non-relative import path using project aliases (e.g. tsconfig paths) */
  resolveAlias?(importPath: string): string | null;
}

/**
 * Concurrency configuration for the parse pipeline.
 *
 * Two **shared budgets** cap the total work in each resource category:
 *   - `ioBudget`  — caps file reads + (caller's) directory scans. I/O-bound.
 *   - `cpuBudget` — caps active worker calls (parser + fallback). CPU-bound.
 *
 * If you don't pass budgets, sensible defaults are derived from
 * `navigator.hardwareConcurrency`. Sharing the same Budget instance across
 * multiple pools lets them compete for one global resource ceiling.
 *
 * `parserCap` / `fallbackCap` set the per-pool concurrency. They should match
 * the number of Web Workers spawned for that stage (no point in pool slots
 * larger than worker count). The reader pool runs **adaptively** under
 * `ioBudget` — it auto-tunes its cap based on observed latency (AIMD).
 */
export interface PipelineLimits {
  ioBudget?: Budget;
  cpuBudget?: Budget;
  parserCap?: number;
  fallbackCap?: number;
  /**
   * End-to-end cap for files currently being read/parsed. This is separate from
   * per-stage caps so slow parsers cannot let the reader stage load the whole
   * project into memory.
   */
  maxInFlightFiles?: number;
}

/** Defaults derived from hardware. Suitable for browser AND Node test envs. */
function getCores(): number {
  if (typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number") {
    return Math.max(2, navigator.hardwareConcurrency);
  }
  return 4;
}

function defaultLimits(limits: PipelineLimits | undefined): {
  ioBudget: Budget;
  cpuBudget: Budget;
  parserCap: number;
  fallbackCap: number;
  maxInFlightFiles: number;
} {
  const cores = getCores();
  const cpuCap = Math.max(2, cores - 1);   // leave 1 core for UI thread
  const ioCap = Math.min(64, cores * 4);   // I/O can oversubscribe; cap to avoid memory blowup
  const ioBudget = limits?.ioBudget ?? new Budget(ioCap);
  const cpuBudget = limits?.cpuBudget ?? new Budget(cpuCap);
  const parserCap = limits?.parserCap ?? Math.max(2, cpuCap - 1);
  const fallbackCap = limits?.fallbackCap ?? Math.max(1, Math.floor(cpuCap / 4));
  const maxInFlightFiles = limits?.maxInFlightFiles ?? Math.min(
    1024,
    Math.max(64, (ioBudget.capacity + parserCap + fallbackCap) * 4),
  );
  if (maxInFlightFiles < 1) {
    throw new Error(`maxInFlightFiles must be >= 1, got ${maxInFlightFiles}`);
  }
  return {
    ioBudget,
    cpuBudget,
    parserCap,
    fallbackCap,
    maxInFlightFiles,
  };
}

export async function getDependencyEntries(
  files: Iterable<string> | AsyncIterable<string>,
  parse: Parse,
  fs: FSLike,
  isIncluded?: (path: string) => boolean,
  {
    resolveAllFiles = false,
    onFileParsed,
    onFileError,
    onFinalizing,
    onFallbackParsed,
    fallbackParse,
    signal,
    limits,
  }: {
    resolveAllFiles?: boolean;
    onFileParsed?: (file: string) => void;
    onFileError?: (file: string, error: unknown) => void;
    onFinalizing?: () => void;
    /** Called when a file falls back to the secondary parser (e.g. Babel) after primary parse fails. */
    onFallbackParsed?: (file: string) => void;
    /** If provided, files that fail primary parse are deferred and retried with this parser */
    fallbackParse?: () => Promise<Parse>;
    signal?: AbortSignal;
    limits?: PipelineLimits;
  } = {},
) {
  const { ioBudget, cpuBudget, parserCap, fallbackCap, maxInFlightFiles } = defaultLimits(limits);
  throwIfAborted(signal);

  // Build the file set as we consume the iterable. Resolution at the end uses
  // this set to look up local dependencies.
  const fileSet = new Set<string>();

  // Raw parse output: [importPath, isAsync][] — kind is added during resolution
  const rawDepMap = new Map<string, [string, boolean][]>();

  // Lazy load fallback parser exactly once on first failure.
  let fallbackPromise: Promise<Parse> | null = null;

  // Stage 1: read file content. Adaptive — auto-tunes its cap under the I/O
  // budget based on observed read latency. On a 10k-file scan there's plenty of
  // time for AIMD to converge; on a tiny scan it just sits at the initial cap.
  const readerPool = new AdaptivePool<string, { file: string; content: string }>(
    ioBudget,
    async (file) => {
      throwIfAborted(signal);
      const content = await raceWithAbort(Promise.resolve(fs.readFile(file)), signal);
      throwIfAborted(signal);
      return { file, content };
    },
  );

  // Stage 2: primary parse — fixed cap = number of OXC workers.
  // Acquires from cpuBudget so it competes fairly with fallback workers.
  const parserPool = new Pool<{ file: string; content: string }, void>(
    parserCap,
    async ({ file, content }) => {
      await cpuBudget.acquire();
      try {
        throwIfAborted(signal);
        const dependencies = await raceWithAbort(Promise.resolve(parse(content)), signal);
        throwIfAborted(signal);
        rawDepMap.set(file, dependencies);
      } finally {
        cpuBudget.release();
      }
    },
  );

  // Stage 3: fallback parse — drains in parallel with parserPool. Same shared
  // cpuBudget so Babel can't starve OXC (and vice versa). Lazy-loaded.
  let fallbackParser: Parse | null = null;
  const fallbackPool = new Pool<{ file: string; content: string }, void>(
    fallbackCap,
    async ({ file, content }) => {
      if (!fallbackParser) {
        if (!fallbackPromise) {
          throw new Error("fallbackPool invoked without a fallbackParse loader");
        }
        fallbackParser = await raceWithAbort(fallbackPromise, signal);
      }
      await cpuBudget.acquire();
      try {
        throwIfAborted(signal);
        const dependencies = await raceWithAbort(Promise.resolve(fallbackParser(content)), signal);
        throwIfAborted(signal);
        rawDepMap.set(file, dependencies);
      } finally {
        cpuBudget.release();
      }
    },
  );

  // Stream files into the pipeline as they arrive, but keep an end-to-end cap on
  // active file tasks. Stage-local caps alone are not enough: if reading is much
  // faster than parsing, every file's source text can otherwise accumulate while
  // waiting for parser workers.
  const processFile = async (file: string) => {
    let content: string;
    try {
      throwIfAborted(signal);
      ({ content } = await readerPool.submit(file));
      throwIfAborted(signal);
    } catch (err) {
      if (isAbortError(err)) throw err;
      onFileError?.(file, err);
      onFileParsed?.(file);
      return;
    }

    try {
      await parserPool.submit({ file, content });
      onFileParsed?.(file);
      return;
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (!fallbackParse) {
        if (onFileError) {
          onFileError(file, err);
          onFileParsed?.(file);
          return;
        }
        throw err;
      }
      // Kick off fallback loading on first failure (loads in parallel with ongoing parses)
      if (!fallbackPromise) fallbackPromise = raceWithAbort(fallbackParse(), signal);
    }

    try {
      await fallbackPool.submit({ file, content });
      onFallbackParsed?.(file);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (onFileError) {
        onFileError(file, err);
      } else {
        throw err;
      }
    }
    onFileParsed?.(file);
  };

  const fileTasks = new Set<Promise<void>>();
  const waitForPipelineRoom = async () => {
    while (fileTasks.size >= maxInFlightFiles) {
      throwIfAborted(signal);
      await raceWithAbort(Promise.race(fileTasks), signal);
    }
  };

  try {
    for await (const file of files) {
      throwIfAborted(signal);
      if (isIncluded && !isIncluded(file)) continue;
      fileSet.add(file);
      await waitForPipelineRoom();
      const task = processFile(file).finally(() => {
        fileTasks.delete(task);
      });
      fileTasks.add(task);
    }

    await raceWithAbort(Promise.all(fileTasks), signal);
  } catch (err) {
    if (isAbortError(err)) {
      for (const task of fileTasks) task.catch(() => undefined);
    }
    throw err;
  }

  throwIfAborted(signal);
  onFinalizing?.();

  const entries: DependencyEntry[] = [];
  for (const [file, dependencies] of rawDepMap.entries()) {
    throwIfAborted(signal);
    const resolvedDependencies: Dependency[] = [];
    for (const [dependency, dynamicImport] of dependencies) {
      try {
        const { path, kind } = resolveDependencyFile(fs, fileSet, file, dependency, resolveAllFiles);
        resolvedDependencies.push([path, dynamicImport, kind]);
      } catch (err) {
        if (onFileError) {
          onFileError(file, err);
        } else {
          throw err;
        }
      }
    }
    entries.push([file, resolvedDependencies]);
  }

  return entries;
}

const RESOLVABLE_EXTS = ["ts", "tsx", "mts", "js", "jsx", "mjs"];
const RESOLVABLE_EXT_SET = new Set(RESOLVABLE_EXTS);

function createAbortError(): Error {
  const error = new Error("Scan aborted");
  error.name = "AbortError";
  return error;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createAbortError();
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(createAbortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/**
 * Node-style resolution: try `base` as-is, then `base.<ext>`, then `base/index.<ext>`.
 * Steps 2 and 3 are skipped if `base` already ends with a known extension (e.g. `foo.tsx`),
 * since appending another extension would produce invalid paths like `foo.tsx.ts`.
 * Returns the first path found in `files`, or `undefined` if none match.
 */
function findInFiles(
  base: string,
  files: Set<string>,
  resolvePath: FSLike["resolvePath"],
): string | undefined {
  if (files.has(base)) return base;
  const baseExt = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
  if (RESOLVABLE_EXT_SET.has(baseExt)) return undefined;
  const withExt = RESOLVABLE_EXTS.map((ext) => `${base}.${ext}`).find((p) => files.has(p));
  if (withExt) return withExt;
  return RESOLVABLE_EXTS.map((ext) => resolvePath(base, `index.${ext}`)).find((p) => files.has(p));
}

function resolveDependencyFile(
  fs: FSLike,
  files: Set<string>,
  file: string,
  dependencyRef: string,
  resolveAllFiles: boolean,
): { path: string; kind: DependencyKind } {
  if (!isRelativePath(dependencyRef)) {
    const aliased = fs.resolveAlias?.(dependencyRef);
    if (aliased) {
      const found = findInFiles(aliased, files, fs.resolvePath.bind(fs));
      return found ? { path: found, kind: "local" } : { path: aliased, kind: "unresolved" };
    }
    return { path: dependencyRef, kind: "external" };
  }

  let base: string;
  try {
    base = fs.resolvePath(file, "..", dependencyRef);
  } catch (err) {
    throw new Error(`Dependency "${dependencyRef}" cannot be resolved from "${file}"`, { cause: err });
  }

  const resolved = findInFiles(base, files, fs.resolvePath.bind(fs));
  if (resolved) return { path: resolved, kind: "local" };

  if (resolveAllFiles) throw new Error(`Dependency "${dependencyRef}" cannot be resolved from "${file}"`);

  return { path: base, kind: "unresolved" };
}
