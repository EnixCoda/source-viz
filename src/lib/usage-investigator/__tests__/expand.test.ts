import { describe, it, expect } from "vitest";
// @ts-expect-error
import * as oxc from "oxc-parser/src-js/wasm.js";
import { analyzeFile, type FileSymbols, type Parser } from "../parseSymbols";
import { resolveExport } from "../resolve";
import { buildImporterIndex, expandUsage, type UsageHit } from "../expand";

const parse: Parser = (filename, source) => {
  const r = (oxc as typeof import("oxc-parser")).parseSync(filename, source, { sourceType: "module" });
  return { program: r.program as any, module: r.module as any };
};

/** Build an in-memory project from a `{path: source}` map. */
function project(files: Record<string, string>) {
  const cache = new Map<string, FileSymbols>();
  const loadSymbols = (file: string): FileSymbols | null => {
    if (cache.has(file)) return cache.get(file)!;
    const src = files[file];
    if (src === undefined) return null;
    const sym = analyzeFile(file, src, parse);
    cache.set(file, sym);
    return sym;
  };
  // Trivial path resolver: source like './x' or '/a/b' relative to the importer dir,
  // matched against the keys of `files`. We use POSIX-style.
  const resolvePath = (importer: string, spec: string): string | null => {
    if (spec.startsWith(".")) {
      const dir = importer.split("/").slice(0, -1);
      const parts = spec.split("/");
      for (const p of parts) {
        if (p === ".") continue;
        if (p === "..") dir.pop();
        else dir.push(p);
      }
      const candidate = dir.join("/");
      // exact match
      if (files[candidate]) return candidate;
      // try common extensions
      for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
        if (files[candidate + ext]) return candidate + ext;
      }
      // index
      for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
        if (files[candidate + "/index" + ext]) return candidate + "/index" + ext;
      }
      return null;
    }
    return files[spec] ? spec : null;
  };
  // Build dep map by parsing every file's imports
  const dependencyMap = new Map<string, Set<string>>();
  for (const file of Object.keys(files)) {
    const sym = loadSymbols(file);
    if (!sym) continue;
    const deps = new Set<string>();
    for (const i of sym.imports) {
      const t = resolvePath(file, i.source);
      if (t) deps.add(t);
    }
    for (const r of sym.reExports) {
      const t = resolvePath(file, r.source);
      if (t) deps.add(t);
    }
    dependencyMap.set(file, deps);
  }
  const importerIndex = buildImporterIndex(dependencyMap);
  return { loadSymbols, resolvePath, importerIndex };
}

const findHit = (hits: UsageHit[], file: string, symbol: string) =>
  hits.find((h) => h.file === file && h.symbol === symbol);

describe("resolve", () => {
  it("resolves alias chain across files", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `export { foo as bar } from './a';`,
      "/c.ts": `export { bar as baz } from './b';`,
    });
    const r = resolveExport("/c.ts", "baz", p.loadSymbols, p.resolvePath);
    expect(r).toEqual({ file: "/a.ts", symbol: "foo" });
  });

  it("resolves through export *", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `export * from './a';`,
    });
    const r = resolveExport("/b.ts", "foo", p.loadSymbols, p.resolvePath);
    expect(r).toEqual({ file: "/a.ts", symbol: "foo" });
  });

  it("survives a re-export cycle without infinite loop", () => {
    const p = project({
      "/a.ts": `export { foo } from './b';`,
      "/b.ts": `export { foo } from './a';`,
    });
    const r = resolveExport("/a.ts", "foo", p.loadSymbols, p.resolvePath);
    // Returns *some* (file, symbol) without crashing.
    expect(r).toBeTruthy();
  });
});

describe("expand", () => {
  it("finds direct importer (caller)", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `import { foo } from './a'; const usesFoo = () => foo;`,
    });
    const hits = expandUsage({
      startFile: "/a.ts",
      startExport: "foo",
      ...p,
    });
    // origin + caller in /b.ts ('usesFoo' is not exported)
    expect(findHit(hits, "/a.ts", "foo")?.kind).toBe("origin");
    expect(findHit(hits, "/b.ts", "usesFoo")?.kind).toBe("caller");
  });

  it("finds wrapper hop and follows it", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `import { foo } from './a'; export const wrap = () => foo;`,
      "/c.ts": `import { wrap } from './b'; export const usesWrap = () => wrap();`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "foo", ...p });
    expect(findHit(hits, "/b.ts", "wrap")?.kind).toBe("wrapper");
    expect(findHit(hits, "/c.ts", "usesWrap")?.kind).toBe("wrapper");
  });

  it("follows re-export hops", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `export { foo } from './a';`,
      "/c.ts": `import { foo } from './b'; export const w = () => foo;`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "foo", ...p });
    expect(findHit(hits, "/b.ts", "foo")?.kind).toBe("re-export");
    expect(findHit(hits, "/c.ts", "w")?.kind).toBe("wrapper");
  });

  it("follows aliased re-exports", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `export { foo as bar } from './a';`,
      "/c.ts": `import { bar } from './b'; export const w = () => bar;`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "foo", ...p });
    expect(findHit(hits, "/b.ts", "bar")?.kind).toBe("re-export");
    expect(findHit(hits, "/c.ts", "w")?.kind).toBe("wrapper");
  });

  it("follows export * fan-out", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/index.ts": `export * from './a';`,
      "/c.ts": `import { foo } from './index'; export const w = () => foo;`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "foo", ...p });
    expect(findHit(hits, "/index.ts", "foo")?.kind).toBe("re-export");
    expect(findHit(hits, "/c.ts", "w")?.kind).toBe("wrapper");
  });

  it("follows namespace member access", () => {
    const p = project({
      "/a.ts": `export const foo = 1;`,
      "/b.ts": `import * as A from './a'; export const w = () => A.foo;`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "foo", ...p });
    expect(findHit(hits, "/b.ts", "w")?.kind).toBe("wrapper");
  });

  it("ignores importers that don't actually reference the symbol", () => {
    const p = project({
      "/a.ts": `export const foo = 1; export const bar = 2;`,
      "/b.ts": `import { bar } from './a'; export const w = () => bar;`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "foo", ...p });
    expect(findHit(hits, "/b.ts", "w")).toBeUndefined();
    // only the origin
    expect(hits.length).toBe(1);
  });

  it("does not infinite-loop on import-graph cycles", () => {
    const p = project({
      "/a.ts": `import { b } from './b'; export const a = () => b();`,
      "/b.ts": `import { a } from './a'; export const b = () => a();`,
    });
    const hits = expandUsage({ startFile: "/a.ts", startExport: "a", ...p });
    expect(hits.length).toBeGreaterThan(0);
    // contains the cycle hop
    expect(findHit(hits, "/b.ts", "b")).toBeDefined();
  });
});
