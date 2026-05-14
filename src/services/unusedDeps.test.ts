import { describe, expect, it } from "vitest";
import { findUnusedDeps, getDeclaredDeps } from "./unusedDeps";
import type { DependencyEntry } from "./serializers";

describe("findUnusedDeps", () => {
  it("returns packages not imported by any file", () => {
    const entries: DependencyEntry[] = [
      ["src/a.ts", [["react", false, "external"], ["./b", false, "local"]]],
      ["src/b.ts", [["lodash/merge", false, "external"]]],
    ];
    const unused = findUnusedDeps(entries, ["react", "lodash", "axios"]);
    expect(unused).toEqual(["axios"]);
  });

  it("handles scoped packages", () => {
    const entries: DependencyEntry[] = [
      ["src/a.ts", [["@chakra-ui/react", false, "external"]]],
    ];
    const unused = findUnusedDeps(entries, ["@chakra-ui/react", "@chakra-ui/icons"]);
    expect(unused).toEqual(["@chakra-ui/icons"]);
  });

  it("returns empty array when all deps are used", () => {
    const entries: DependencyEntry[] = [
      ["src/a.ts", [["react", false, "external"]]],
    ];
    expect(findUnusedDeps(entries, ["react"])).toEqual([]);
  });

  it("matches subpath imports to the package name", () => {
    const entries: DependencyEntry[] = [
      ["src/a.ts", [["lodash/merge", false, "external"]]],
    ];
    expect(findUnusedDeps(entries, ["lodash"])).toEqual([]);
  });
});

describe("getDeclaredDeps", () => {
  it("returns only dependencies by default", () => {
    const pkg = { dependencies: { react: "^18" }, devDependencies: { vitest: "^1" } };
    expect(getDeclaredDeps(pkg)).toEqual(["react"]);
  });

  it("includes devDependencies when requested", () => {
    const pkg = { dependencies: { react: "^18" }, devDependencies: { vitest: "^1" } };
    expect(getDeclaredDeps(pkg, { includeDevDependencies: true })).toEqual(["react", "vitest"]);
  });

  it("filters out @types/* packages", () => {
    const pkg = { dependencies: { react: "^18", "@types/react": "^18" } };
    expect(getDeclaredDeps(pkg)).toEqual(["react"]);
  });
});
