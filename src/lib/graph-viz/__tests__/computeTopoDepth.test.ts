import { describe, it, expect } from "vitest";
import { computeTopoDepth } from "../GraphViz";
import { NodeObject, ResolvedLink } from "../types";

function makeNodes(ids: string[]): NodeObject[] {
  return ids.map((id) => ({ id }));
}

function makeLinks(pairs: [string, string][], nodes: NodeObject[]): ResolvedLink[] {
  const m = new Map(nodes.map((n) => [n.id, n]));
  return pairs.map(([s, t]) => ({ source: m.get(s)!, target: m.get(t)! }));
}

describe("computeTopoDepth", () => {
  it("returns 0 for all nodes when there are no links", () => {
    const nodes = makeNodes(["a", "b", "c"]);
    const depth = computeTopoDepth(nodes, []);
    expect(depth.get("a")).toBe(0);
    expect(depth.get("b")).toBe(0);
    expect(depth.get("c")).toBe(0);
  });

  it("computes depth along a simple chain", () => {
    const nodes = makeNodes(["a", "b", "c", "d"]);
    const links = makeLinks([["a", "b"], ["b", "c"], ["c", "d"]], nodes);
    const depth = computeTopoDepth(nodes, links);
    expect(depth.get("a")).toBe(0);
    expect(depth.get("b")).toBe(1);
    expect(depth.get("c")).toBe(2);
    expect(depth.get("d")).toBe(3);
  });

  it("uses the longest path when there are multiple paths", () => {
    // a → b → d, a → c → d (both length 2; a→d would be 1)
    const nodes = makeNodes(["a", "b", "c", "d"]);
    const links = makeLinks(
      [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"], ["a", "d"]],
      nodes
    );
    const depth = computeTopoDepth(nodes, links);
    expect(depth.get("d")).toBe(2);
  });

  it("terminates on a graph with a cycle (regression test)", () => {
    // a → b → c → a is a 3-cycle; also a 'd' off b for shape.
    // Without the depth cap this BFS would push forever.
    const nodes = makeNodes(["a", "b", "c", "d"]);
    const links = makeLinks(
      [["a", "b"], ["b", "c"], ["c", "a"], ["b", "d"]],
      nodes
    );
    // Just asserting it returns is the regression check.
    const depth = computeTopoDepth(nodes, links);
    for (const n of nodes) {
      const d = depth.get(n.id) ?? 0;
      expect(d).toBeLessThanOrEqual(nodes.length - 1);
    }
  });

  it("handles many overlapping cycles without exploding the queue", () => {
    // Build a dense graph with cycles: 50 nodes in a ring + extra cross links.
    const ids = Array.from({ length: 50 }, (_, i) => `n${i}`);
    const nodes = makeNodes(ids);
    const ringPairs: [string, string][] = ids.map((id, i) => [id, ids[(i + 1) % ids.length]]);
    const crossPairs: [string, string][] = ids.map((id, i) => [id, ids[(i + 7) % ids.length]]);
    const links = makeLinks([...ringPairs, ...crossPairs], nodes);

    const start = Date.now();
    const depth = computeTopoDepth(nodes, links);
    const elapsed = Date.now() - start;

    expect(depth.size).toBe(nodes.length);
    expect(elapsed).toBeLessThan(1000); // sanity bound; actual run is sub-ms
    for (const n of nodes) {
      expect(depth.get(n.id)!).toBeLessThanOrEqual(nodes.length - 1);
    }
  });
});
