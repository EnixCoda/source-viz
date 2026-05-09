/**
 * Lazy file reader and path resolver for the on-demand investigator.
 *
 * Reads files from a `FileSystemDirectoryHandle` on demand. Caches the
 * raw source per file (small projects only — no eviction).
 *
 * The path resolver mirrors the scanner's import-resolution rules but
 * works against a prebuilt **set of known file paths** (the nodes of the
 * existing file dep graph) rather than walking the FS again.
 */
import pathBrowserify from "path-browserify";

const RESOLVABLE_EXTS = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];

/**
 * Lazy file reader interface. Two implementations exist:
 *  - `createDirectoryHandleFs` — reads on demand from a `FileSystemDirectoryHandle`.
 *  - `createMemoryFs`          — reads from an in-memory map (used by demo mode
 *                                where source contents are bundled with the
 *                                dependency entries).
 */
export interface InvestigatorFs {
  readFile(path: string): Promise<string | null>;
}

export function createDirectoryHandleFs(root: FileSystemDirectoryHandle): InvestigatorFs {
  const cache = new Map<string, string | null>();
  return {
    async readFile(path: string): Promise<string | null> {
      if (cache.has(path)) return cache.get(path)!;
      try {
        const segments = path.split("/").filter(Boolean);
        let dir: FileSystemDirectoryHandle = root;
        for (let i = 0; i < segments.length - 1; i++) {
          dir = await dir.getDirectoryHandle(segments[i]);
        }
        const fileName = segments[segments.length - 1];
        const fh = await dir.getFileHandle(fileName);
        const file = await fh.getFile();
        const text = await file.text();
        cache.set(path, text);
        return text;
      } catch {
        cache.set(path, null);
        return null;
      }
    },
  };
}

export function createMemoryFs(sources: Record<string, string>): InvestigatorFs {
  return {
    async readFile(path: string): Promise<string | null> {
      return Object.prototype.hasOwnProperty.call(sources, path) ? sources[path] : null;
    },
  };
}

/**
 * Build a path resolver that resolves an import specifier from `importerFile`
 * against the set of known file paths.
 *
 * Behavior matches the scanner roughly:
 *  - `./x`     -> joins relative to importer dir, tries exts + /index
 *  - `path/x`  -> alias-resolve via `resolveAlias`, else returns null (external)
 */
export function buildPathResolver(
  knownFiles: Set<string>,
  resolveAlias?: (spec: string) => string | null,
): (importerFile: string, spec: string) => string | null {
  const findVariant = (base: string): string | null => {
    if (knownFiles.has(base)) return base;
    if (base.includes(".") && RESOLVABLE_EXTS.includes(base.slice(base.lastIndexOf(".") + 1))) {
      return null;
    }
    for (const ext of RESOLVABLE_EXTS) {
      const cand = `${base}.${ext}`;
      if (knownFiles.has(cand)) return cand;
    }
    for (const ext of RESOLVABLE_EXTS) {
      const cand = pathBrowserify.join(base, `index.${ext}`);
      if (knownFiles.has(cand)) return cand;
    }
    return null;
  };

  return (importerFile, spec) => {
    if (spec.startsWith(".")) {
      let base: string;
      try {
        base = pathBrowserify.join(importerFile, "..", spec);
      } catch {
        return null;
      }
      return findVariant(base);
    }
    if (resolveAlias) {
      const aliased = resolveAlias(spec);
      if (aliased) return findVariant(aliased);
    }
    // external — not investigable
    return null;
  };
}
