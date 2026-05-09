import { describe, it, expect } from "vitest";
import { applyNodeColors } from "../renderer";
import { RenderNode, ResolvedLink } from "../types";

function makeNodes(ids: string[]): RenderNode[] {
  return ids.map((id) => ({ id, x: 0, y: 0 }));
}

function makeLinks(pairs: [string, string][], nodes: RenderNode[]): ResolvedLink[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return pairs.map(([s, t]) => ({ source: nodeMap.get(s)!, target: nodeMap.get(t)! }));
}

describe("applyNodeColors", () => {
  describe("color-by-depth", () => {
    it("assigns colors to all nodes", () => {
      const nodes = makeNodes(["a.ts", "src/b.ts", "src/utils/c.ts"]);
      const links = makeLinks([["a.ts", "src/b.ts"], ["src/b.ts", "src/utils/c.ts"]], nodes);

      applyNodeColors(nodes, links, "color-by-depth");

      for (const node of nodes) {
        expect(node._color).toBeDefined();
        // Color may be hsl/rgb/hex depending on the gradient used; just
        // verify it's a non-empty string the canvas can accept.
        expect(typeof node._color).toBe("string");
        expect(node._color!.length).toBeGreaterThan(0);
      }
    });

    it("deeper files get different colors than shallow files", () => {
      const nodes = makeNodes(["a.ts", "a/b/c/d/e.ts"]);
      const links: ResolvedLink[] = [];

      applyNodeColors(nodes, links, "color-by-depth");

      expect(nodes[0]._color).not.toBe(nodes[1]._color);
    });

    it("files at the same depth get the same color", () => {
      const nodes = makeNodes(["src/a.ts", "src/b.ts"]);
      const links: ResolvedLink[] = [];

      applyNodeColors(nodes, links, "color-by-depth");

      expect(nodes[0]._color).toBe(nodes[1]._color);
    });
  });

  describe("color-by-connections", () => {
    it("nodes with more connections get different color than isolated nodes", () => {
      const nodes = makeNodes(["hub", "a", "b", "c", "isolated"]);
      const links = makeLinks(
        [["hub", "a"], ["hub", "b"], ["hub", "c"]],
        nodes
      );

      applyNodeColors(nodes, links, "color-by-connections");

      // hub has 3 connections, isolated has 0
      expect(nodes[0]._color).not.toBe(nodes[4]._color);
    });

    it("assigns colors to all nodes", () => {
      const nodes = makeNodes(["a", "b"]);
      const links = makeLinks([["a", "b"]], nodes);

      applyNodeColors(nodes, links, "color-by-connections");

      for (const node of nodes) {
        expect(node._color).toBeDefined();
      }
    });
  });

  describe("color-by-imports", () => {
    it("only counts source-side connections", () => {
      // a -> b -> c: a has 1 outgoing, b has 1 outgoing, c has 0
      const nodes = makeNodes(["a", "b", "c"]);
      const links = makeLinks([["a", "b"], ["b", "c"]], nodes);

      applyNodeColors(nodes, links, "color-by-imports");

      // a and b each have 1 source connection, c has 0
      expect(nodes[0]._color).toBe(nodes[1]._color); // same count
      expect(nodes[2]._color).not.toBe(nodes[0]._color); // different count
    });
  });

  describe("color-by-imported-by", () => {
    it("only counts target-side connections", () => {
      // a -> c, b -> c: c has 2 incoming, a and b have 0
      const nodes = makeNodes(["a", "b", "c"]);
      const links = makeLinks([["a", "c"], ["b", "c"]], nodes);

      applyNodeColors(nodes, links, "color-by-imported-by");

      // c has 2 target connections, a and b have 0
      expect(nodes[0]._color).toBe(nodes[1]._color); // both 0
      expect(nodes[2]._color).not.toBe(nodes[0]._color); // c is different
    });
  });

  it("handles empty graph", () => {
    const nodes: RenderNode[] = [];
    expect(() => applyNodeColors(nodes, [], "color-by-depth")).not.toThrow();
  });

  it("handles single node with no links", () => {
    const nodes = makeNodes(["only.ts"]);
    applyNodeColors(nodes, [], "color-by-connections");
    expect(nodes[0]._color).toBeDefined();
  });
});
