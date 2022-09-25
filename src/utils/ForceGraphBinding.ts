import ForceGraph from "force-graph";

export function createGraph(ele: HTMLElement) {
  return ForceGraph()(ele);
}
