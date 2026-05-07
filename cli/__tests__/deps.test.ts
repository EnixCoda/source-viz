import { describe, it, expect } from "vitest";
import * as nodepath from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "../scanner";

const FIXTURE_DIR = nodepath.resolve(nodepath.dirname(fileURLToPath(import.meta.url)), "fixtures");

function bfsReachable(start: string, adjMap: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of adjMap.get(node) ?? []) if (!visited.has(next)) queue.push(next);
  }
  visited.delete(start);
  return visited;
}

describe("deps", () => {
  it("lists direct dependencies of a file", async () => {
    const { depMap } = await scan(FIXTURE_DIR, { silent: true });
    const deps = depMap.get("a.ts") ?? new Set();
    expect(deps.has("b.ts")).toBe(true);
  });

  it("lists direct dependents of a file", async () => {
    const { dependantMap } = await scan(FIXTURE_DIR, { silent: true });
    const dependents = dependantMap.get("b.ts") ?? new Set();
    expect(dependents.has("a.ts")).toBe(true);
  });

  it("resolves transitive dependencies", async () => {
    const { depMap } = await scan(FIXTURE_DIR, { silent: true });
    // a.ts → b.ts → c.ts (transitive)
    const transitive = bfsReachable("a.ts", depMap);
    expect(transitive.has("b.ts")).toBe(true);
    expect(transitive.has("c.ts")).toBe(true);
  });

  it("resolves transitive dependents", async () => {
    const { dependantMap } = await scan(FIXTURE_DIR, { silent: true });
    // c.ts is transitively depended on by a.ts
    const transitive = bfsReachable("c.ts", dependantMap);
    expect(transitive.has("b.ts")).toBe(true);
    expect(transitive.has("a.ts")).toBe(true);
  });

  it("returns empty set for unknown file", async () => {
    const { depMap } = await scan(FIXTURE_DIR, { silent: true });
    expect(depMap.get("nonexistent.ts")).toBeUndefined();
  });
});
