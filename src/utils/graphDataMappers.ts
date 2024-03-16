import { GraphData, LinkObject, NodeObject } from "force-graph";

// MUTATION IS ALLOWED IN THIS FILE

export const cloneData = // clone data to prevent pollution
  ({ nodes, links }: GraphData) => ({
    nodes: nodes.map((node) => ({ ...node })),
    links: links.map((link) => ({ ...link })),
  });

type ColorByHeatMode = "color-by-heat-source" | "color-by-heat-target" | "color-by-heat-both";
type ColorByDepthMode = "color-by-depth";

export type ColorByMode = ColorByHeatMode | ColorByDepthMode;

export const getNodeId = (node: LinkObject["source"] | LinkObject["target"]) =>
  typeof node === "string" ? node : node?.id;

export function colorByHeat(mode: ColorByHeatMode) {
  type NodeObjectWithHeat = NodeObject & {
    [key in ColorByHeatMode]?: number;
  };

  return (data: GraphData) => {
    const countMap = new Map<NodeObject["id"], number>();
    data.links.forEach((link) => {
      if (mode !== "color-by-heat-target") {
        const source = getNodeId(link.source);
        if (source !== undefined) countMap.set(source, (countMap.get(source) || 0) + 1);
      }
      if (mode !== "color-by-heat-source") {
        const target = getNodeId(link.target);
        if (target !== undefined) countMap.set(target, (countMap.get(target) || 0) + 1);
      }
    });

    data.nodes.forEach((node) => ((node as NodeObjectWithHeat)[mode] = (node.id && countMap.get(node.id)) || 0));

    return data;
  };
}

export function colorByDepth() {
  type NodeObjectWithDepth = NodeObject & {
    [key in ColorByDepthMode]?: number;
  };

  const getDepth = (node: NodeObject) => [...(node.id?.matchAll(/\//g) || [])].length;

  return (data: GraphData) => {
    data.nodes.forEach((node) => ((node as NodeObjectWithDepth)["color-by-depth"] ||= getDepth(node)));

    return data;
  };
}

export function getColorByDataMapper(colorBy: ColorByMode) {
  switch (colorBy) {
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
