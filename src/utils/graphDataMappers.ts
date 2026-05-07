import { ColorByMode, GraphData, NodeObject } from "../lib/graph-viz";

// MUTATION IS ALLOWED IN THIS FILE

export const cloneData = // clone data to prevent pollution
  ({ nodes, links }: GraphData): GraphData => ({
    nodes: nodes.map((node) => ({ ...node })),
    links: links.map((link) => ({ ...link })),
  });

export type { ColorByMode };

type ColorByHeatMode = "color-by-heat-source" | "color-by-heat-target" | "color-by-heat-both";

export const getNodeId = (node: string | NodeObject | undefined) =>
  typeof node === "string" ? node : node?.id;

export function colorByHeat(mode: ColorByHeatMode) {
  return (data: GraphData) => {
    const countMap = new Map<string, number>();
    data.links.forEach((link) => {
      if (mode !== "color-by-heat-target") {
        const source = typeof link.source === "string" ? link.source : link.source;
        if (source !== undefined) countMap.set(source, (countMap.get(source) || 0) + 1);
      }
      if (mode !== "color-by-heat-source") {
        const target = typeof link.target === "string" ? link.target : link.target;
        if (target !== undefined) countMap.set(target, (countMap.get(target) || 0) + 1);
      }
    });

    data.nodes.forEach((node) => ((node as NodeObject & Record<string, unknown>)[mode] = (node.id && countMap.get(node.id)) || 0));

    return data;
  };
}

export function colorByDepth() {
  const getDepth = (node: NodeObject) => [...(node.id?.matchAll(/\//g) || [])].length;

  return (data: GraphData) => {
    data.nodes.forEach((node) => ((node as NodeObject & Record<string, unknown>)["color-by-depth"] ||= getDepth(node)));

    return data;
  };
}

export function getColorByDataMapper(colorBy: ColorByMode) {
  switch (colorBy) {
    case "color-by-module":
      return (data: GraphData) => data; // handled by renderer's applyNodeColors
    case "color-by-depth":
      return colorByDepth();
    case "color-by-heat-both":
    case "color-by-heat-source":
    case "color-by-heat-target":
      return colorByHeat(colorBy);
    default:
      throw new Error(`Unknown colorBy: ${colorBy}`);
  }
}
