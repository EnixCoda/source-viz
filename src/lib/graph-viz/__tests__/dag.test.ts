import { describe, it, expect } from "vitest";
import { applyDagLayout } from "../dag";
import { NodeObject, ResolvedLink } from "../types";

function makeNodes(ids: string[]): NodeObject[] {
  return ids.map((id) => ({ id }));
}

function makeLinks(pairs: [string, string][], nodes: NodeObject[]): ResolvedLink[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return pairs.map(([s, t]) => ({ source: nodeMap.get(s)!, target: nodeMap.get(t)! }));
}

describe("applyDagLayout", () => {
  it("assigns positions to a simple chain (td mode)", () => {
    const nodes = makeNodes(["a", "b", "c"]);
    const links = makeLinks([["a", "b"], ["b", "c"]], nodes);

    applyDagLayout({
      nodes,
      links,
      mode: "td",
      levelDistance: 100,
      width: 400,
      height: 400,
    });

    // All nodes should have defined positions
    for (const node of nodes) {
      expect(node.x).toBeDefined();
      expect(node.y).toBeDefined();
    }

    // In "td" (top-down), a should be above b, b above c (lower y = higher)
    expect(nodes[0].y!).toBeLessThan(nodes[1].y!);
    expect(nodes[1].y!).toBeLessThan(nodes[2].y!);
  });

  it("assigns positions in lr mode (left to right)", () => {
    const nodes = makeNodes(["a", "b", "c"]);
    const links = makeLinks([["a", "b"], ["b", "c"]], nodes);

    applyDagLayout({
      nodes,
      links,
      mode: "lr",
      levelDistance: 100,
      width: 600,
      height: 400,
    });

    // In "lr", a should be left of b, b left of c
    expect(nodes[0].x!).toBeLessThan(nodes[1].x!);
    expect(nodes[1].x!).toBeLessThan(nodes[2].x!);
  });

  it("assigns positions in bu mode (bottom-up)", () => {
    const nodes = makeNodes(["a", "b", "c"]);
    const links = makeLinks([["a", "b"], ["b", "c"]], nodes);

    applyDagLayout({
      nodes,
      links,
      mode: "bu",
      levelDistance: 100,
      width: 400,
      height: 400,
    });

    // In "bu", root (a) should be at bottom (higher y), c at top
    expect(nodes[0].y!).toBeGreaterThan(nodes[2].y!);
  });

  it("assigns positions in rl mode (right to left)", () => {
    const nodes = makeNodes(["a", "b"]);
    const links = makeLinks([["a", "b"]], nodes);

    applyDagLayout({
      nodes,
      links,
      mode: "rl",
      levelDistance: 100,
      width: 400,
      height: 400,
    });

    // In "rl", root (a) should be to the right of b
    expect(nodes[0].x!).toBeGreaterThan(nodes[1].x!);
  });

  it("handles radialout mode without crashing", () => {
    const nodes = makeNodes(["center", "a", "b"]);
    const links = makeLinks([["center", "a"], ["center", "b"]], nodes);

    applyDagLayout({
      nodes,
      links,
      mode: "radialout",
      levelDistance: 80,
      width: 400,
      height: 400,
    });

    for (const node of nodes) {
      expect(node.x).toBeDefined();
      expect(node.y).toBeDefined();
    }
  });

  it("handles graph with all nodes in a cycle (no roots)", () => {
    const nodes = makeNodes(["a", "b", "c"]);
    const links = makeLinks([["a", "b"], ["b", "c"], ["c", "a"]], nodes);

    // Should not throw; positions may remain undefined
    expect(() => {
      applyDagLayout({
        nodes,
        links,
        mode: "td",
        levelDistance: 100,
        width: 400,
        height: 400,
      });
    }).not.toThrow();
  });

  it("handles disconnected nodes", () => {
    const nodes = makeNodes(["a", "b", "island"]);
    const links = makeLinks([["a", "b"]], nodes);

    applyDagLayout({
      nodes,
      links,
      mode: "lr",
      levelDistance: 100,
      width: 400,
      height: 400,
    });

    // Connected nodes should have positions
    expect(nodes[0].x).toBeDefined();
    expect(nodes[1].x).toBeDefined();
    // Island should also get a position (level 0)
    expect(nodes[2].x).toBeDefined();
  });

  it("handles empty graph", () => {
    expect(() => {
      applyDagLayout({
        nodes: [],
        links: [],
        mode: "td",
        levelDistance: 100,
        width: 400,
        height: 400,
      });
    }).not.toThrow();
  });
});
