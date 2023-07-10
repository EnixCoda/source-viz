import { ForceGraphInstance, GraphData, LinkObject, NodeObject } from "force-graph";

// MUTATION IS ALLOWED IN THIS FILE

export const cloneData = // clone data to prevent pollution
  ({ nodes, links }: GraphData) => ({
    nodes: nodes.map((node) => ({ ...node })),
    links: links.map((link) => ({ ...link })),
  });

enum colorByKeys {
  heat = "heat",
  depth = "depth",
}

// ts check that NodeObject has not keys of colorByKeys

export const decorateForColorBy = (graph: ForceGraphInstance, key: (typeof colorByKeys)[keyof typeof colorByKeys]) =>
  graph.nodeAutoColorBy(key);

export function colorByHeat(mode: "source" | "target" | "both") {
  const key = colorByKeys.heat;
  type NodeObjectWithHeat = NodeObject & {
    [key in colorByKeys.heat]?: number;
  };

  return (data: GraphData) => {
    const getId = (node: LinkObject["source"] | LinkObject["target"]) => (typeof node === "string" ? node : node?.id);

    const countMap = new Map<NodeObject["id"], number>();
    data.links.forEach((link) => {
      if (mode !== "target") {
        const source = getId(link.source);
        if (source !== undefined) countMap.set(source, (countMap.get(source) || 0) + 1);
      }
      if (mode !== "source") {
        const target = getId(link.target);
        if (target !== undefined) countMap.set(target, (countMap.get(target) || 0) + 1);
      }
    });

    data.nodes.forEach((node) => ((node as NodeObjectWithHeat)[key] = (node.id && countMap.get(node.id)) || 0));

    return data;
  };
}

export function colorByDepth() {
  const key = colorByKeys.depth;

  type NodeObjectWithDepth = NodeObject & {
    [key in colorByKeys.depth]?: number;
  };

  const getDepth = (node: NodeObject) => [...(node.id?.matchAll(/\//g) || [])].length;

  return (data: GraphData) => {
    data.nodes.forEach((node) => ((node as NodeObjectWithDepth)[key] ||= getDepth(node)));

    return data;
  };
}

export function getColorByDataMapper(colorBy: string) {
  switch (colorBy) {
    case colorByKeys.depth:
      return colorByDepth();
    case "connection-both":
      return colorByHeat("both");
    case "connection-dependency":
      return colorByHeat("source");
    case "connection-dependant":
      return colorByHeat("target");
    default:
      throw new Error(`Unknown colorBy: ${colorBy}`);
  }
}
