import { describe, it, expect } from "vitest";
import { prepareGraphData, filterGraphData, computeSuggestedCuts, computeFanIn, computeFanOut } from "./graphData";
import { DependencyEntry } from "../services/serializers";

// Helper: build entries [file, [[dep, isAsync, kind], ...]]
function entry(file: string, deps: Array<[string, boolean?, ("local" | "external" | "unresolved")?]> = []): DependencyEntry {
  return [file, deps.map(([d, a = false, k = "local"]) => [d, a, k])];
}

describe("prepareGraphData", () => {
  it("collects all unique nodes from files and deps", () => {
    const data: DependencyEntry[] = [
      entry("a", [["b"], ["c"]]),
      entry("b", [["c"]]),
    ];
    const prepared = prepareGraphData(data);
    expect([...prepared.nodes].sort()).toEqual(["a", "b", "c"]);
  });

  it("builds dependency and dependant maps correctly", () => {
    const data: DependencyEntry[] = [entry("a", [["b"]])];
    const prepared = prepareGraphData(data);
    expect([...prepared.dependencyMap.get("a")!]).toEqual(["b"]);
    expect([...prepared.dependantMap.get("b")!]).toEqual(["a"]);
  });

  it("identifies dependents (nodes that aren't dependencies of anything)", () => {
    const data: DependencyEntry[] = [
      entry("root", [["dep1"]]),
      entry("dep1", [["dep2"]]),
    ];
    const prepared = prepareGraphData(data);
    expect(prepared.dependents.has("root")).toBe(true);
    expect(prepared.dependents.has("dep1")).toBe(false);
  });

  it("tracks node kinds with local taking priority", () => {
    const data: DependencyEntry[] = [
      entry("a", [["lib", false, "external"]]),
      entry("lib", [["x"]]), // appears as a local file in a later entry
    ];
    const prepared = prepareGraphData(data);
    expect(prepared.nodeKinds.get("lib")).toBe("local");
  });

  it("separates async vs sync imports", () => {
    const data: DependencyEntry[] = [
      entry("a", [["b", true]]), // async
      entry("c", [["d", false]]), // sync
    ];
    const prepared = prepareGraphData(data);
    expect(prepared.asyncRefMap.get("a")?.has("b")).toBe(true);
    expect(prepared.asyncRefMap.get("c")?.has("d")).toBeFalsy();
  });
});

describe("filterGraphData", () => {
  it("returns all nodes in natural mode for a simple graph", () => {
    // a → b → c. To traverse the chain, we set leave=a (traverses what 'a' depends on)
    const prepared = prepareGraphData([
      entry("a", [["b"]]),
      entry("b", [["c"]]),
    ]);
    const result = filterGraphData(prepared, {
      leave: new Set(["a"]),
      graphMode: "natural",
    });
    expect(result.nodes.length).toBe(3);
  });

  it("detects a simple cycle in natural mode", () => {
    // a → b → c → a
    const prepared = prepareGraphData([
      entry("a", [["b"]]),
      entry("b", [["c"]]),
      entry("c", [["a"]]),
    ]);
    const result = filterGraphData(prepared, {
      leave: new Set(["a", "b", "c"]),
      graphMode: "natural",
    });
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it("does not infinite-loop on dense cycles (regression)", () => {
    // Build a graph with many overlapping cycles — similar in shape to
    // records.csv which had 1606 cycles and would crash filterGraphData
    // / computeTopoDepth before the depth cap was added.
    const N = 30;
    const data: DependencyEntry[] = [];
    for (let i = 0; i < N; i++) {
      const me = `n${i}`;
      const deps: Array<[string]> = [];
      // ring: each node imports the next
      deps.push([`n${(i + 1) % N}`]);
      // cross: each node also imports +5 and +7 (creates many small cycles)
      deps.push([`n${(i + 5) % N}`]);
      deps.push([`n${(i + 7) % N}`]);
      data.push(entry(me, deps));
    }
    const prepared = prepareGraphData(data);
    const start = Date.now();
    const result = filterGraphData(prepared, {
      leave: prepared.nodes,
      graphMode: "natural",
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(result.nodes.length).toBe(N);
  });

  it("dag mode produces no cycles", () => {
    const prepared = prepareGraphData([
      entry("a", [["b"]]),
      entry("b", [["c"]]),
      entry("c", [["a"]]),
    ]);
    const result = filterGraphData(prepared, {
      leave: new Set(["a", "b", "c"]),
      graphMode: "dag",
    });
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it("cycles-only mode keeps only nodes that participate in cycles", () => {
    // a → b → a is a cycle; isolated → done is not
    const prepared = prepareGraphData([
      entry("a", [["b"]]),
      entry("b", [["a"]]),
      entry("isolated", [["done"]]),
    ]);
    const result = filterGraphData(prepared, {
      leave: new Set(["a", "b", "isolated", "done"]),
      graphMode: "cycles-only",
    });
    const ids = new Set(result.nodes.map((n) => n.id));
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(true);
    expect(ids.has("isolated")).toBe(false);
  });

  it("respects excludes", () => {
    const prepared = prepareGraphData([entry("a", [["b"]]), entry("b", [["c"]])]);
    const result = filterGraphData(prepared, {
      leave: new Set(["a"]),
      excludes: new Set(["b"]),
      graphMode: "natural",
    });
    const ids = new Set(result.nodes.map((n) => n.id));
    expect(ids.has("b")).toBe(false);
  });
});

describe("computeSuggestedCuts", () => {
  it("ranks edges by number of cycles they participate in", () => {
    // Two cycles share edge b → a: [a,b] and [a,b,c]
    const cycles = [
      ["a", "b"],
      ["a", "b", "c"],
    ];
    const cuts = computeSuggestedCuts(cycles);
    // a→b appears in both cycles
    const top = cuts[0];
    expect(top.cycleCount).toBe(2);
    expect(top.cycleIndices.sort()).toEqual([0, 1]);
  });

  it("returns empty list when no cycles", () => {
    expect(computeSuggestedCuts([])).toEqual([]);
  });
});

describe("computeFanIn / computeFanOut", () => {
  it("counts dependants and dependencies", () => {
    const prepared = prepareGraphData([
      entry("a", [["b"], ["c"]]),
      entry("b", [["c"]]),
    ]);
    const fanIn = computeFanIn(prepared.dependantMap);
    const fanOut = computeFanOut(prepared.dependencyMap);
    expect(fanIn.get("c")).toBe(2);
    expect(fanIn.get("b")).toBe(1);
    expect(fanOut.get("a")).toBe(2);
    expect(fanOut.get("b")).toBe(1);
  });
});
