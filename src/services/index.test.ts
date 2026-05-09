import { describe, it, expect, vi } from "vitest";
import * as nodepath from "node:path";
import { getDependencyEntries } from "./index";
import type { FSLike } from "./index";

const files: Record<string, string> = {
  "a.ts": `import './b';`,
  "b.ts": `import './c';`,
  "c.ts": `export const x = 1;`,
};

const mockFs: FSLike = {
  resolvePath: (...parts) => nodepath.normalize(parts.join("/")),
  readFile: async (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  },
};

const fileSet = new Set(Object.keys(files));

describe("getDependencyEntries", () => {
  it("parses all included files", async () => {
    const parse = (source: string): [string, boolean][] => {
      const matches = [...source.matchAll(/import '(.+?)'/g)];
      return matches.map((m) => [m[1], false]);
    };
    const entries = await getDependencyEntries(fileSet, parse, mockFs, () => true);
    expect(entries.length).toBe(3);
    const aEntry = entries.find(([f]) => f === "a.ts");
    // resolves to b.ts (via extension lookup) or raw "./b" if not in set
    expect(aEntry?.[1][0][0]).toMatch(/b/);
  });

  it("calls onFileError when parse throws and no fallback", async () => {
    const brokenParse = () => { throw new Error("parse error"); };
    const errors: string[] = [];
    await getDependencyEntries(new Set(["a.ts"]), brokenParse, mockFs, () => true, {
      onFileError: (file) => errors.push(file),
    });
    expect(errors).toContain("a.ts");
  });

  it("uses fallbackParse when primary parse fails", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primaryParse = (source: string): [string, boolean][] => {
      primaryCalls++;
      if (source.includes("import './b'")) throw new Error("OXC unsupported syntax");
      return [];
    };
    const fallbackFn = (source: string): [string, boolean][] => {
      fallbackCalls++;
      const matches = [...source.matchAll(/import '(.+?)'/g)];
      return matches.map((m) => [m[1], false]);
    };

    const entries = await getDependencyEntries(fileSet, primaryParse, mockFs, () => true, {
      fallbackParse: async () => fallbackFn,
    });

    // a.ts, b.ts, c.ts all attempted by primary; a.ts failed and was retried
    expect(primaryCalls).toBe(3);
    expect(fallbackCalls).toBe(1);

    // a.ts should have a dependency resolved
    const aEntry = entries.find(([f]) => f === "a.ts");
    expect(aEntry).toBeDefined();
    expect(aEntry![1].length).toBe(1);
  });

  it("fallbackParse loads lazily only when first failure occurs", async () => {
    const fallbackFactory = vi.fn(async () => (_source: string): [string, boolean][] => []);
    const primaryParse = (): [string, boolean][] => [];

    await getDependencyEntries(fileSet, primaryParse, mockFs, () => true, {
      fallbackParse: fallbackFactory,
    });

    // Primary never failed, so fallback factory should never be called
    expect(fallbackFactory).not.toHaveBeenCalled();
  });

  it("continues parsing remaining files while fallback loads", async () => {
    const parsedFiles: string[] = [];
    let fallbackResolve!: () => void;
    const fallbackLoaded = new Promise<void>((res) => { fallbackResolve = res; });

    // a.ts fails primary parse; b.ts and c.ts succeed
    const primaryParse = (source: string): [string, boolean][] => {
      if (source.includes("import './b'")) throw new Error("unsupported");
      return [];
    };

    let fallbackCalls = 0;
    const fallbackFactory = async () => {
      await fallbackLoaded;
      return (_source: string): [string, boolean][] => {
        fallbackCalls++;
        return [];
      };
    };

    const parsePromise = getDependencyEntries(fileSet, primaryParse, mockFs, () => true, {
      fallbackParse: fallbackFactory,
      onFileParsed: (file) => parsedFiles.push(file),
    });

    // Give event loop time to advance past b.ts and c.ts
    await new Promise((r) => setTimeout(r, 20));
    expect(parsedFiles).toContain("b.ts");
    expect(parsedFiles).toContain("c.ts");
    expect(parsedFiles).not.toContain("a.ts"); // still deferred

    // Unblock fallback
    fallbackResolve();
    await parsePromise;

    expect(parsedFiles).toContain("a.ts");
    expect(fallbackCalls).toBe(1);
  });

  it("starts parsing files as soon as they arrive from an async iterable (streaming)", async () => {
    // Files arrive one by one with a delay between them. The pipeline should
    // start reading the first file immediately, not wait for the iterable to drain.
    const events: string[] = [];

    async function* slowFiles() {
      for (const f of ["a.ts", "b.ts", "c.ts"]) {
        events.push(`yield-${f}`);
        yield f;
        await new Promise((r) => setTimeout(r, 30));
      }
      events.push("yield-done");
    }

    const slowFs: FSLike = {
      resolvePath: (...p) => nodepath.normalize(p.join("/")),
      readFile: async (path) => {
        events.push(`read-${path}`);
        return files[path];
      },
    };

    const parse = (): [string, boolean][] => [];
    await getDependencyEntries(slowFiles(), parse, slowFs, () => true);

    // Crucial: first read must happen before the iterable finishes producing.
    const yieldDoneIdx = events.indexOf("yield-done");
    const readAIdx = events.indexOf("read-a.ts");
    expect(readAIdx).toBeGreaterThanOrEqual(0);
    expect(readAIdx).toBeLessThan(yieldDoneIdx);
  });

  it("bounds in-flight files so slow parsers do not read the whole project into memory", async () => {
    const manyFiles = Array.from({ length: 10 }, (_, i) => `f${i}.ts`);
    let readCount = 0;
    let releaseParse!: () => void;
    const parseBlocked = new Promise<void>((resolve) => { releaseParse = resolve; });
    const fs: FSLike = {
      resolvePath: (...p) => nodepath.normalize(p.join("/")),
      readFile: async () => {
        readCount++;
        return "";
      },
    };
    const parse = async (): Promise<[string, boolean][]> => {
      await parseBlocked;
      return [];
    };

    const scanPromise = getDependencyEntries(manyFiles, parse, fs, () => true, {
      limits: { maxInFlightFiles: 2, parserCap: 1 },
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(readCount).toBeLessThanOrEqual(2);

    releaseParse();
    await scanPromise;
    expect(readCount).toBe(manyFiles.length);
  });

  it("aborts in-flight scans without continuing to read files", async () => {
    const manyFiles = Array.from({ length: 10 }, (_, i) => `f${i}.ts`);
    const abortController = new AbortController();
    let readCount = 0;
    const fs: FSLike = {
      resolvePath: (...p) => nodepath.normalize(p.join("/")),
      readFile: async () => {
        readCount++;
        return "";
      },
    };
    const parse = async (): Promise<[string, boolean][]> => new Promise(() => {});

    const scanPromise = getDependencyEntries(manyFiles, parse, fs, () => true, {
      signal: abortController.signal,
      limits: { maxInFlightFiles: 2, parserCap: 1 },
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(readCount).toBeLessThanOrEqual(2);
    abortController.abort();

    await expect(scanPromise).rejects.toMatchObject({ name: "AbortError" });
    const readsAfterAbort = readCount;
    await new Promise((r) => setTimeout(r, 20));
    expect(readCount).toBe(readsAfterAbort);
  });

  it("drains fallback pool in parallel with primary pool (no head-of-line blocking)", async () => {
    // Setup: 4 files all fail primary parse → all go to fallback
    const manyFiles: Record<string, string> = {
      "f1.ts": "import './x'", "f2.ts": "import './x'", "f3.ts": "import './x'", "f4.ts": "import './x'",
    };
    const manyFs: FSLike = {
      resolvePath: (...p) => nodepath.normalize(p.join("/")),
      readFile: async (path) => manyFiles[path] ?? (() => { throw new Error("nf"); })(),
    };
    const events: string[] = [];

    const primaryParse = (): [string, boolean][] => {
      throw new Error("always fail");
    };
    const fallbackFn = async (_source: string): Promise<[string, boolean][]> => {
      events.push("fb-start");
      await new Promise((r) => setTimeout(r, 30));
      events.push("fb-end");
      return [];
    };

    const t0 = Date.now();
    await getDependencyEntries(new Set(Object.keys(manyFiles)), primaryParse, manyFs, () => true, {
      fallbackParse: async () => fallbackFn,
      limits: { fallbackCap: 2 }, // 2 babel workers
    });
    const elapsed = Date.now() - t0;

    // With 4 files × 30ms each, serial would take ≥120ms.
    // With 2 in parallel (fallback pool cap=2), should take ~60ms.
    expect(elapsed).toBeLessThan(110);
    expect(events.filter((e) => e === "fb-end").length).toBe(4);
  });
});
