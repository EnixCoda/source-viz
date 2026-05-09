/**
 * Cross-module symbol resolution for the usage investigator.
 *
 * Given a target `(file, exportedName)`, follow re-export chains
 * (`export { x as y } from 'mod'`, `export *`, `export * as N from 'mod'`)
 * back to the canonical file that *actually* defines the symbol.
 *
 * Used by the expander to:
 *  - canonicalize an import binding to its origin so taint propagation can
 *    short-circuit
 *  - decide whether a re-export chain in the importer reaches the target
 */
import type { FileSymbols, ReExport } from "./parseSymbols";

export type SymbolRef = { file: string; symbol: string };

/** Resolves a path specifier (e.g. './x') against the importing file. */
export type PathResolver = (importerFile: string, specifier: string) => string | null;

export type LoadSymbols = (file: string) => FileSymbols | null;

/**
 * Resolve `file::exportedName` to its canonical (file, symbol) origin.
 *
 * Returns `null` if:
 *  - file's symbols can't be loaded
 *  - exportedName is unknown
 *  - chain leads to an unresolvable specifier
 *
 * Cycles are broken — if we revisit a (file, symbol) we've seen, return that
 * pair as the canonical (it's a cycle of pure re-exports, so any node on the
 * cycle is equivalent for taint purposes).
 */
export function resolveExport(
  file: string,
  exportedName: string,
  loadSymbols: LoadSymbols,
  resolvePath: PathResolver,
  visited: Set<string> = new Set(),
): SymbolRef | null {
  const key = `${file}::${exportedName}`;
  if (visited.has(key)) return { file, symbol: exportedName };
  visited.add(key);

  const sym = loadSymbols(file);
  if (!sym) return null;

  // 1. Local export?
  const localExport = sym.exports.find((e) => e.name === exportedName);
  if (localExport && localExport.declIndex !== -1) {
    return { file, symbol: localExport.localName };
  }

  // 2. Named re-export?
  const named = sym.reExports.find(
    (r): r is Extract<ReExport, { kind: "named" }> =>
      r.kind === "named" && r.exportedAs === exportedName,
  );
  if (named) {
    const target = resolvePath(file, named.source);
    if (!target) return null;
    return resolveExport(target, named.importedName, loadSymbols, resolvePath, visited);
  }

  // 3. Namespace re-export?
  //    `export * as N from './x'` — the export is the whole namespace.
  //    For taint propagation purposes, re-exporting a whole module under a
  //    name doesn't pinpoint a single origin symbol, but the importer asking
  //    for "N" probably intends to use members later. We canonicalize to the
  //    re-exporting file itself as the namespace owner.
  const ns = sym.reExports.find(
    (r): r is Extract<ReExport, { kind: "namespace" }> =>
      r.kind === "namespace" && r.exportedAs === exportedName,
  );
  if (ns) {
    return { file, symbol: exportedName };
  }

  // 4. export * — search transitively through all `export *` sources.
  for (const r of sym.reExports) {
    if (r.kind !== "all") continue;
    const target = resolvePath(file, r.source);
    if (!target) continue;
    // Only recurse if the target plausibly exports this name.
    const inner = loadSymbols(target);
    if (!inner) continue;
    if (
      inner.exports.some((e) => e.name === exportedName) ||
      inner.reExports.some((rr) =>
        (rr.kind === "named" && rr.exportedAs === exportedName) ||
        (rr.kind === "namespace" && rr.exportedAs === exportedName) ||
        rr.kind === "all", // could fan out further
      )
    ) {
      const hit = resolveExport(target, exportedName, loadSymbols, resolvePath, visited);
      if (hit) return hit;
    }
  }

  return null;
}

/**
 * Given an import binding in `file`, return the canonical origin of the
 * imported symbol it brings into local scope. Returns `null` if unresolvable.
 *
 *   import { foo as f } from './x';     => resolveExport('./x' resolved, 'foo')
 *   import * as N from './x';           => returns null (namespace bound; use
 *                                          resolveNamespaceMember instead)
 */
export function resolveNamedImport(
  file: string,
  importedName: string,
  importedFromSpec: string,
  loadSymbols: LoadSymbols,
  resolvePath: PathResolver,
): SymbolRef | null {
  const target = resolvePath(file, importedFromSpec);
  if (!target) return null;
  return resolveExport(target, importedName, loadSymbols, resolvePath);
}

/**
 * Resolve `N.foo` where `N` is `import * as N from './x'`.
 * Returns the canonical origin of `foo` exported by `./x`.
 */
export function resolveNamespaceMember(
  file: string,
  namespaceSpec: string,
  memberName: string,
  loadSymbols: LoadSymbols,
  resolvePath: PathResolver,
): SymbolRef | null {
  const target = resolvePath(file, namespaceSpec);
  if (!target) return null;
  return resolveExport(target, memberName, loadSymbols, resolvePath);
}
