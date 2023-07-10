import { ForceGraphInstance } from "force-graph";
import * as React from "react";
import { GraphDecorator } from "../../utils/graphDecorators";

export function useGraphDecorator<T>(
  graph: ForceGraphInstance | null,
  decorator: GraphDecorator<T>,
  options: T,
  enabled: boolean = true,
) {
  React.useEffect(() => {
    if (!graph) return;
    if (!enabled) return;
    return decorator(graph, options);
  }, [graph, decorator, options, enabled]);
}
