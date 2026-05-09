/**
 * BFS expansion of usage from a starting (file, exportedName).
 *
 * Algorithm:
 *  1. Canonicalize the start to its origin.
 *  2. Frontier holds canonical (file, symbol) pairs along with the local
 *     "names" we should look for in importers (named import, namespace
 *     member access, or re-export).
 *  3. For each item, ask the file dep graph for its **importers** (the files
 *     that depend on it), then for each importer load its symbols and check:
 *       a. Re-export — if importer re-exports the symbol, add its
 *          (importer, exportedAs) as a new canonical with kind 're-export'.
 *       b. Wrapper — if any *exported* top-level decl in importer references
 *          the import local (or namespace member), add that decl as new
 *          canonical with kind 'wrapper'.
 *       c. Caller — if a non-exported decl in importer references it,
 *          record a 'caller' hit (terminal — non-exports don't propagate).
 *  4. Yield each new finding; stop when frontier is empty.
 *
 * Cycle-safe via a visited set on canonical (file, symbol) pairs.
 */
import { resolveExport, type LoadSymbols, type PathResolver, type SymbolRef } from "./resolve";
import { memberKey, type FileSymbols } from "./parseSymbols";

export type UsageKind = "origin" | "re-export" | "wrapper" | "caller";

export type UsageHit = {
  file: string;
  symbol: string;
  kind: UsageKind;
  /** The (file, symbol) that *led* to this hit (null for the root). */
  parent: SymbolRef | null;
  /** BFS hop distance from origin. */
  hop: number;
};

/** Reverse-importer index: file -> Set of files that import it. */
export type ImporterIndex = Map<string, Set<string>>;

/** Build a reverse-importer index from the existing dependency map.
 *  `dependencyMap[file]` = files that `file` depends on
 *  result[dep] = set of files importing `dep`
 */
export function buildImporterIndex(dependencyMap: Map<string, Set<string>>): ImporterIndex {
  const index: ImporterIndex = new Map();
  for (const [importer, deps] of dependencyMap) {
    for (const dep of deps) {
      let set = index.get(dep);
      if (!set) {
        set = new Set();
        index.set(dep, set);
      }
      set.add(importer);
    }
  }
  return index;
}

export type ExpandOptions = {
  startFile: string;
  startExport: string;
  importerIndex: ImporterIndex;
  loadSymbols: LoadSymbols;
  resolvePath: PathResolver;
  /** Optional cap on hops (default: Infinity). */
  maxHops?: number;
  /** Optional cap on hits to emit (safety net for huge graphs). */
  maxHits?: number;
  /** Yields after each hit, allowing UI to render incrementally. */
  onHit?: (hit: UsageHit) => void;
};

/**
 * Run the BFS. Returns the full list of hits (also calls `onHit` for each).
 */
export function expandUsage(opts: ExpandOptions): UsageHit[] {
  const {
    startFile,
    startExport,
    importerIndex,
    loadSymbols,
    resolvePath,
    maxHops = Infinity,
    maxHits = 10000,
    onHit,
  } = opts;

  const hits: UsageHit[] = [];
  const visited = new Set<string>();
  const keyOf = (s: SymbolRef) => `${s.file}::${s.symbol}`;

  // Canonicalize root
  const origin = resolveExport(startFile, startExport, loadSymbols, resolvePath) ?? {
    file: startFile,
    symbol: startExport,
  };
  visited.add(keyOf(origin));

  const rootHit: UsageHit = {
    file: origin.file,
    symbol: origin.symbol,
    kind: "origin",
    parent: null,
    hop: 0,
  };
  hits.push(rootHit);
  onHit?.(rootHit);

  type FrontierItem = SymbolRef & { hop: number };
  const frontier: FrontierItem[] = [{ ...origin, hop: 0 }];

  while (frontier.length > 0 && hits.length < maxHits) {
    const cur = frontier.shift()!;
    if (cur.hop >= maxHops) continue;
    const importers = importerIndex.get(cur.file);
    if (!importers || importers.size === 0) continue;

    for (const importerFile of importers) {
      const sym = loadSymbols(importerFile);
      if (!sym) continue;

      // Find the local names by which `importerFile` refers to (cur.file, cur.symbol)
      const localNames = findLocalNamesFor(importerFile, sym, cur, loadSymbols, resolvePath);
      const hasAnyLocal = localNames.size > 0;
      const hasAnyReExport = localNames.directNamesFromSource.size > 0 || localNames.namespaceFromSource.size > 0;
      if (!hasAnyLocal && !hasAnyReExport) continue;

      // a) Re-exports
      for (const r of sym.reExports) {
        if (r.kind === "named") {
          if (!localNames.directNamesFromSource.has(`${r.source}::${r.importedName}`)) continue;
          // canonicalize re-exported symbol against cur (already canonical)
          const canon: SymbolRef = { file: importerFile, symbol: r.exportedAs };
          if (visited.has(keyOf(canon))) continue;
          visited.add(keyOf(canon));
          const hit: UsageHit = {
            file: importerFile,
            symbol: r.exportedAs,
            kind: "re-export",
            parent: cur,
            hop: cur.hop + 1,
          };
          hits.push(hit);
          onHit?.(hit);
          frontier.push({ ...canon, hop: hit.hop });
        } else if (r.kind === "namespace") {
          // export * as N from cur.file -> N.cur.symbol becomes accessible
          // We canonicalize as (importerFile, N) so anyone using N.<curSymbol> in
          // a downstream file can be discovered via memberRefs match later.
          if (!localNames.namespaceFromSource.has(r.source)) continue;
          // We don't add this as a wrapper hit because the re-exporter doesn't
          // *use* the symbol; downstream files using importerFile.<r.exportedAs>
          // would need to do member access. We add the namespace itself to
          // frontier with a synthetic symbol so downstream can match.
          const canon: SymbolRef = { file: importerFile, symbol: r.exportedAs };
          if (visited.has(keyOf(canon))) continue;
          visited.add(keyOf(canon));
          const hit: UsageHit = {
            file: importerFile,
            symbol: r.exportedAs,
            kind: "re-export",
            parent: cur,
            hop: cur.hop + 1,
          };
          hits.push(hit);
          onHit?.(hit);
          // do NOT push to frontier — namespace re-exports propagate via
          // member access in downstream files, which we can't model without
          // a member-aware importer index. Acceptable v1 limitation.
        } else if (r.kind === "all") {
          // export * from cur.file -> cur.symbol becomes accessible under same name
          const target = resolvePath(importerFile, r.source);
          if (target !== cur.file) continue;
          const canon: SymbolRef = { file: importerFile, symbol: cur.symbol };
          if (visited.has(keyOf(canon))) continue;
          visited.add(keyOf(canon));
          const hit: UsageHit = {
            file: importerFile,
            symbol: cur.symbol,
            kind: "re-export",
            parent: cur,
            hop: cur.hop + 1,
          };
          hits.push(hit);
          onHit?.(hit);
          frontier.push({ ...canon, hop: hit.hop });
        }
      }

      // b/c) Decl references
      for (const decl of sym.decls) {
        let used = false;
        for (const local of localNames.locals) {
          if (decl.refs.has(local)) { used = true; break; }
        }
        if (!used) {
          for (const m of localNames.memberHits) {
            if (decl.memberRefs.has(m)) { used = true; break; }
          }
        }
        if (!used) continue;

        const canon: SymbolRef = { file: importerFile, symbol: decl.name };
        if (visited.has(keyOf(canon))) continue;

        if (decl.isExported) {
          visited.add(keyOf(canon));
          const hit: UsageHit = {
            file: importerFile,
            symbol: decl.name,
            kind: "wrapper",
            parent: cur,
            hop: cur.hop + 1,
          };
          hits.push(hit);
          onHit?.(hit);
          frontier.push({ ...canon, hop: hit.hop });
        } else {
          // Caller — terminal (non-exported)
          const hit: UsageHit = {
            file: importerFile,
            symbol: decl.name,
            kind: "caller",
            parent: cur,
            hop: cur.hop + 1,
          };
          hits.push(hit);
          onHit?.(hit);
        }
      }
    }
  }

  return hits;
}

type LocalNameMatch = {
  /** Local binding names in the importer that resolve to `cur`. */
  locals: Set<string>;
  /** Namespace member keys (`${ns}\u0000${member}`) in the importer that
   *  resolve to `cur`. */
  memberHits: Set<string>;
  /** Source-spec keys (`${source}::${importedName}`) that re-export entries
   *  may match against. */
  directNamesFromSource: Set<string>;
  /** Source specs that match `cur.file` for `export *`/`export * as N`. */
  namespaceFromSource: Set<string>;
  size: number;
};

function findLocalNamesFor(
  importerFile: string,
  sym: FileSymbols,
  cur: SymbolRef,
  loadSymbols: LoadSymbols,
  resolvePath: PathResolver,
): LocalNameMatch {
  const locals = new Set<string>();
  const memberHits = new Set<string>();
  const directNamesFromSource = new Set<string>();
  const namespaceFromSource = new Set<string>();

  for (const imp of sym.imports) {
    const target = resolvePath(importerFile, imp.source);
    if (!target) continue;
    if (imp.kind === "named") {
      // Direct match: does this import bring in *exactly* cur?
      if (target === cur.file && imp.importedName === cur.symbol) {
        locals.add(imp.localName);
        directNamesFromSource.add(`${imp.source}::${imp.importedName}`);
        continue;
      }
      // Indirect: importedName might resolve back to cur via a re-export chain
      const canon = resolveExport(target, imp.importedName, loadSymbols, resolvePath);
      if (canon && canon.file === cur.file && canon.symbol === cur.symbol) {
        locals.add(imp.localName);
        directNamesFromSource.add(`${imp.source}::${imp.importedName}`);
      }
    } else if (imp.kind === "namespace") {
      // `import * as N from imp.source` — N.<curSymbol> is a hit if imp.source
      // can reach cur (directly or via export-* chains).
      const reachable = isExportReachable(target, cur, loadSymbols, resolvePath, new Set());
      if (reachable) {
        memberHits.add(memberKey(imp.localName, cur.symbol));
        namespaceFromSource.add(imp.source);
      }
    }
  }

  // Re-export source matchers (used in re-export pass above)
  for (const r of sym.reExports) {
    if (r.kind === "named") {
      const target = resolvePath(importerFile, r.source);
      if (!target) continue;
      if (target === cur.file && r.importedName === cur.symbol) {
        directNamesFromSource.add(`${r.source}::${r.importedName}`);
        continue;
      }
      const canon = resolveExport(target, r.importedName, loadSymbols, resolvePath);
      if (canon && canon.file === cur.file && canon.symbol === cur.symbol) {
        directNamesFromSource.add(`${r.source}::${r.importedName}`);
      }
    } else if (r.kind === "namespace" || r.kind === "all") {
      const target = resolvePath(importerFile, r.source);
      if (target && isExportReachable(target, cur, loadSymbols, resolvePath, new Set())) {
        namespaceFromSource.add(r.source);
      }
    }
  }

  return {
    locals, memberHits, directNamesFromSource, namespaceFromSource,
    size: locals.size + memberHits.size,
  };
}

function isExportReachable(
  file: string,
  target: SymbolRef,
  loadSymbols: LoadSymbols,
  resolvePath: PathResolver,
  seen: Set<string>,
): boolean {
  if (file === target.file) {
    const sym = loadSymbols(file);
    if (!sym) return false;
    return sym.exports.some((e) => e.localName === target.symbol || e.name === target.symbol);
  }
  if (seen.has(file)) return false;
  seen.add(file);
  const sym = loadSymbols(file);
  if (!sym) return false;
  // Follow export * chains
  for (const r of sym.reExports) {
    if (r.kind === "all" || r.kind === "namespace") {
      const next = resolvePath(file, r.source);
      if (next && isExportReachable(next, target, loadSymbols, resolvePath, seen)) return true;
    } else if (r.kind === "named") {
      const next = resolvePath(file, r.source);
      if (next === target.file) {
        const inner = loadSymbols(next);
        if (inner?.exports.some((e) => e.localName === target.symbol)) return true;
      }
    }
  }
  return false;
}
