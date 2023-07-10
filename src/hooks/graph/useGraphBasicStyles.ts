import { ForceGraphInstance } from "force-graph";
import * as React from "react";

export function useGraphBasicStyles(graph: ForceGraphInstance | null) {
  React.useEffect(() => {
    if (!graph) return;
    graph.nodeId("id").nodeLabel("id").linkDirectionalArrowLength(2);
  }, [graph]);
}
