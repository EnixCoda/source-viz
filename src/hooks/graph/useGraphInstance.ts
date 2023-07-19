import ForceGraph, { ForceGraphInstance } from "force-graph";
import * as React from "react";

export function useGraphInstance<E extends HTMLElement>() {
  const [graph, setGraph] = React.useState<ForceGraphInstance | null>(null);
  const ref = React.useRef<E | null>(null);

  React.useEffect(() => {
    const current = ref.current;
    if (!current) return;
    const graph = ForceGraph()(current);
    setGraph(() => graph);
    return () => {
      graph._destructor();
      setGraph(null);
    };
  }, [ref]);

  return { ref, graph };
}
