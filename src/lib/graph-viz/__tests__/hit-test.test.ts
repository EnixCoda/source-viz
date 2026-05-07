import { describe, it, expect } from "vitest";
import { hitTestNode, asyncLinkKey } from "../hit-test";
import { RenderNode } from "../types";

describe("hitTestNode", () => {
  const makeNode = (id: string, x: number, y: number, w = 100, h = 20): RenderNode => ({
    id,
    x,
    y,
    _width: w,
    _height: h,
  });

  it("returns null for empty nodes array", () => {
    expect(hitTestNode([], 50, 50)).toBeNull();
  });

  it("returns null when pointer is outside all nodes", () => {
    const nodes = [makeNode("a", 0, 0, 60, 20)];
    expect(hitTestNode(nodes, 200, 200)).toBeNull();
  });

  it("detects a hit when pointer is inside node bounds", () => {
    const nodes = [makeNode("a", 100, 100, 60, 20)];
    // Pointer right at center
    expect(hitTestNode(nodes, 100, 100)?.id).toBe("a");
  });

  it("detects hit at node edges", () => {
    const node = makeNode("a", 50, 50, 40, 10);
    const nodes = [node];
    // Left edge
    expect(hitTestNode(nodes, 30, 50)?.id).toBe("a");
    // Right edge
    expect(hitTestNode(nodes, 70, 50)?.id).toBe("a");
    // Top edge
    expect(hitTestNode(nodes, 50, 45)?.id).toBe("a");
    // Bottom edge
    expect(hitTestNode(nodes, 50, 55)?.id).toBe("a");
  });

  it("returns null just outside node bounds", () => {
    const node = makeNode("a", 50, 50, 40, 10);
    const nodes = [node];
    // Just outside right
    expect(hitTestNode(nodes, 71, 50)).toBeNull();
    // Just outside bottom
    expect(hitTestNode(nodes, 50, 56)).toBeNull();
  });

  it("returns topmost (last) node when overlapping", () => {
    const nodes = [
      makeNode("bottom", 50, 50, 100, 100),
      makeNode("top", 50, 50, 100, 100),
    ];
    expect(hitTestNode(nodes, 50, 50)?.id).toBe("top");
  });

  it("skips nodes with undefined x/y", () => {
    const node: RenderNode = { id: "no-pos", _width: 100, _height: 20 };
    expect(hitTestNode([node], 0, 0)).toBeNull();
  });

  it("uses default dimensions when _width/_height not set", () => {
    const node: RenderNode = { id: "default", x: 0, y: 0 };
    // Default is 60x16, so half is 30x8
    expect(hitTestNode([node], 0, 0)?.id).toBe("default");
    expect(hitTestNode([node], 29, 7)?.id).toBe("default");
    expect(hitTestNode([node], 31, 0)).toBeNull();
  });
});

describe("asyncLinkKey", () => {
  it("creates a directional key", () => {
    expect(asyncLinkKey("src/a.ts", "src/b.ts")).toBe("src/a.ts->src/b.ts");
  });

  it("different direction produces different key", () => {
    expect(asyncLinkKey("a", "b")).not.toBe(asyncLinkKey("b", "a"));
  });
});
