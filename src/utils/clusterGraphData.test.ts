import { describe, it, expect } from "vitest";
import { CLUSTER_PREFIX, clusterGraphData, isClusterId } from "./clusterGraphData";

const n = (id: string) => ({ id, kind: "local" as const });

describe("clusterGraphData", () => {
  it("rolls up nodes sharing top-level directory at depth 1", () => {
    const out = clusterGraphData({
      nodes: [n("src/a/x.ts"), n("src/a/y.ts"), n("src/b/z.ts"), n("README.md")],
      links: [
        { source: "src/a/x.ts", target: "src/b/z.ts" },
        { source: "src/a/y.ts", target: "src/b/z.ts" },
        { source: "src/a/x.ts", target: "src/a/y.ts" },
        { source: "src/b/z.ts", target: "README.md" },
      ],
    }, 1);

    const ids = out.nodes.map((x) => x.id).sort();
    expect(ids).toEqual([`${CLUSTER_PREFIX}src/`, "README.md"].sort());

    const linkKeys = new Set(out.links.map((l) => `${l.source}->${l.target}`));
    expect(linkKeys).toEqual(new Set([`${CLUSTER_PREFIX}src/->README.md`]));

    expect(out.childrenMap.get(`${CLUSTER_PREFIX}src/`)?.sort()).toEqual([
      "src/a/x.ts", "src/a/y.ts", "src/b/z.ts",
    ]);
  });

  it("respects deeper grouping depth", () => {
    const out = clusterGraphData({
      nodes: [n("src/a/x.ts"), n("src/a/y.ts"), n("src/b/z.ts")],
      links: [
        { source: "src/a/x.ts", target: "src/b/z.ts" },
        { source: "src/a/y.ts", target: "src/b/z.ts" },
      ],
    }, 2);

    const ids = out.nodes.map((x) => x.id).sort();
    expect(ids).toEqual([`${CLUSTER_PREFIX}src/a/`, `${CLUSTER_PREFIX}src/b/`]);

    expect(out.links).toHaveLength(1);
    expect(out.links[0]).toMatchObject({
      source: `${CLUSTER_PREFIX}src/a/`,
      target: `${CLUSTER_PREFIX}src/b/`,
    });
  });

  it("leaves shallow paths untouched (single segment)", () => {
    const out = clusterGraphData({
      nodes: [n("README.md"), n("LICENSE")],
      links: [{ source: "README.md", target: "LICENSE" }],
    }, 1);

    const ids = out.nodes.map((x) => x.id).sort();
    expect(ids).toEqual(["LICENSE", "README.md"]);
  });

  it("isClusterId detects cluster prefix", () => {
    expect(isClusterId(`${CLUSTER_PREFIX}src/`)).toBe(true);
    expect(isClusterId("src/a.ts")).toBe(false);
  });
});
