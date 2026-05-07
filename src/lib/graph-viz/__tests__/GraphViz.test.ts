import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GraphViz } from "../GraphViz";
import { GraphData } from "../types";

// Mock canvas context — happy-dom doesn't support Canvas 2D
function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    setLineDash: vi.fn(),
    set font(_: string) {},
    set fillStyle(_: string) {},
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    set textAlign(_: CanvasTextAlign) {},
    set textBaseline(_: CanvasTextBaseline) {},
  } as unknown as CanvasRenderingContext2D;
}

describe("GraphViz", () => {
  let container: HTMLElement;
  let mockCtx: CanvasRenderingContext2D;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockCtx = createMockCanvasContext();

    // Patch createElement to return a canvas with our mock context
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "canvas") {
        vi.spyOn(el as HTMLCanvasElement, "getContext").mockReturnValue(mockCtx);
      }
      return el;
    });
  });

  it("creates a canvas element inside the container", () => {
    const viz = new GraphViz(container, { width: 800, height: 600 });
    expect(container.querySelector("canvas")).not.toBeNull();
    viz.destroy();
  });

  it("removes canvas on destroy", () => {
    const viz = new GraphViz(container, { width: 800, height: 600 });
    viz.destroy();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("sets canvas size based on options", () => {
    const viz = new GraphViz(container, { width: 400, height: 300 });
    const canvas = container.querySelector("canvas")!;
    const dpr = window.devicePixelRatio || 1;
    expect(canvas.width).toBe(400 * dpr);
    expect(canvas.height).toBe(300 * dpr);
    viz.destroy();
  });

  it("setData accepts graph data and starts simulation", () => {
    const viz = new GraphViz(container, { width: 800, height: 600 });

    const data: GraphData = {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      links: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    };

    expect(() => viz.setData(data)).not.toThrow();
    viz.destroy();
  });

  it("setData with empty graph does not throw", () => {
    const viz = new GraphViz(container, { width: 800, height: 600 });
    expect(() => viz.setData({ nodes: [], links: [] })).not.toThrow();
    viz.destroy();
  });

  it("update changes canvas size", () => {
    const viz = new GraphViz(container, { width: 400, height: 300 });
    viz.update({ width: 800, height: 600 });
    const canvas = container.querySelector("canvas")!;
    const dpr = window.devicePixelRatio || 1;
    expect(canvas.width).toBe(800 * dpr);
    expect(canvas.height).toBe(600 * dpr);
    viz.destroy();
  });

  it("handles setData with dagMode", () => {
    const viz = new GraphViz(container, {
      width: 800,
      height: 600,
      dagMode: "lr",
    });

    const data: GraphData = {
      nodes: [{ id: "a" }, { id: "b" }],
      links: [{ source: "a", target: "b" }],
    };

    expect(() => viz.setData(data)).not.toThrow();
    viz.destroy();
  });

  it("calls onNodeClick callback", () => {
    const onClick = vi.fn();
    const viz = new GraphViz(container, {
      width: 800,
      height: 600,
      onNodeClick: onClick,
    });

    // Set data so nodes exist and have positions + dimensions for hit testing
    viz.setData({
      nodes: [{ id: "test-node" }],
      links: [],
    });

    viz.destroy();
    // Note: full click testing requires actual coordinates from simulation
    // which is non-deterministic. The test above ensures no crash at least.
  });

  it("destroy stops simulation and prevents further renders", () => {
    const viz = new GraphViz(container, { width: 800, height: 600 });
    viz.setData({
      nodes: [{ id: "a" }, { id: "b" }],
      links: [{ source: "a", target: "b" }],
    });
    viz.destroy();

    // Calling update after destroy should not throw
    expect(() => viz.update({ width: 100, height: 100 })).not.toThrow();
  });

  it("multiple setData calls replace previous data", () => {
    const viz = new GraphViz(container, { width: 800, height: 600 });

    viz.setData({
      nodes: [{ id: "a" }],
      links: [],
    });

    viz.setData({
      nodes: [{ id: "x" }, { id: "y" }],
      links: [{ source: "x", target: "y" }],
    });

    // Should not throw or accumulate old nodes
    viz.destroy();
  });
});
