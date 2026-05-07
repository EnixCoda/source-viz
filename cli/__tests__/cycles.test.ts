import { describe, it, expect } from "vitest";
import * as nodepath from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "../scanner";

const FIXTURE_DIR = nodepath.resolve(nodepath.dirname(fileURLToPath(import.meta.url)), "fixtures");

function findCycles(depMap: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const allCycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (onStack.has(node)) {
      allCycles.push(path.slice(path.indexOf(node)));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    onStack.add(node);
    path.push(node);
    for (const dep of depMap.get(node) ?? []) dfs(dep, [...path]);
    onStack.delete(node);
  }

  for (const node of depMap.keys()) if (!visited.has(node)) dfs(node, []);

  const seen = new Set<string>();
  return allCycles.filter((cycle) => {
    const min = cycle.reduce((a, b) => (a < b ? a : b));
    const i = cycle.indexOf(min);
    const normalized = [...cycle.slice(i), ...cycle.slice(0, i)].join("|");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

describe("cycles", () => {
  it("detects no cycles in acyclic fixture", async () => {
    const { depMap } = await scan(FIXTURE_DIR, { silent: true });
    const acyclicMap = new Map([...depMap].filter(([k]) => !k.includes("cycle")));
    expect(findCycles(acyclicMap)).toHaveLength(0);
  });

  it("detects cycles in cyclic fixture", async () => {
    const { depMap } = await scan(FIXTURE_DIR, { silent: true });
    const cycles = findCycles(depMap);
    expect(cycles.length).toBeGreaterThan(0);
    const cycleNodes = cycles.flat();
    expect(cycleNodes.some((n) => n.includes("cycle-a"))).toBe(true);
    expect(cycleNodes.some((n) => n.includes("cycle-b"))).toBe(true);
  });
});
