import ForceGraph, { GraphData } from "force-graph";

export function createGraphRenderer(ele: HTMLElement) {
  const graph = ForceGraph()(ele).nodeId("id").nodeLabel("id").linkDirectionalArrowLength(2);
  const render = (data: GraphData) => graph.graphData(data);

  return { graph, render };
}
