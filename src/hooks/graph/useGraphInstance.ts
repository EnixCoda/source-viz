import * as React from "react";
import { createGraph } from "../../utils/ForceGraphBinding";
import { wrapNewStateForDispatching } from "../../utils/general";

export function useGraphInstance(ref: React.MutableRefObject<HTMLDivElement | null>) {
  const [graph, setGraph] = React.useState<ReturnType<typeof createGraph> | null>(null);

  React.useEffect(() => {
    const current = ref.current;
    if (current) {
      const graph = createGraph(current);
      setGraph(wrapNewStateForDispatching(graph));
      return () => {
        graph._destructor();
        setGraph(null);
      };
    }
  }, [ref, setGraph]);

  return graph;
}
