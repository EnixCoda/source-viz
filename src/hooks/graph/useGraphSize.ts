import { ForceGraphInstance } from "force-graph";
import * as React from "react";

export function useGraphSize(graph: ForceGraphInstance | null, width: number, height: number) {
  React.useEffect(() => {
    if (!graph) return;
    graph.width(width).height(height);
  }, [graph, width, height]);
}
