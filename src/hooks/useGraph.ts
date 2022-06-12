import { GraphData } from "force-graph";
import * as React from "react";
import { createGraphRenderer } from "../utils/ForceGraphBinding";
import {
  colorByDepth,
  DAGDirections,
  freezeNodeOnDragEnd,
  highlightNodeOnHover,
  renderAsDAG,
  renderNodeAsText,
  selectNodeOnMouseDown
} from "../utils/graphDecorators";
import { data } from "../warehouse";

export function useGraph({
  dagMode,
  renderAsText,
  fixNodeOnDragEnd,
}: {
  dagMode: DAGDirections | "";
  renderAsText: boolean;
  fixNodeOnDragEnd: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [selectedNodeInState, setSelectedNodeInState] = React.useState<string | null>(null);
  const [render, setRender] = React.useState<ReturnType<typeof createGraphRenderer>["render"] | null>(null);
  const selectedNodeRef = React.useRef<string | null>(null);
  const setNodeSelection = React.useCallback((id: string | null): void => {
    setSelectedNodeInState(id);
    selectedNodeRef.current = id;
  }, []);

  React.useEffect(() => {
    if (!ref.current) {
      setRender(null);
      return;
    }

    const { graph, render } = createGraphRenderer(ref.current);

    // start decorating graph
    graph.width(window.innerWidth / 2).height(window.innerHeight);

    const dataMappers: (({ nodes, links }: GraphData) => GraphData)[] = [];

    dataMappers.push(colorByDepth(graph).mapData);

    if (fixNodeOnDragEnd) freezeNodeOnDragEnd(graph);

    if (dagMode !== "") renderAsDAG(graph, dagMode);

    if (renderAsText) renderNodeAsText(graph, () => selectedNodeRef.current);
    else highlightNodeOnHover(graph, data);

    selectNodeOnMouseDown(graph, setNodeSelection);

    // preprocess data for rendering
    const mapData = (data: GraphData) => dataMappers.reduce((prev, mapData) => mapData(prev), data);

    setRender(() => (data: GraphData) => render(mapData(data)));

    return () => graph._destructor();
  }, [fixNodeOnDragEnd, dagMode, renderAsText]);

  return [ref, render, selectedNodeInState, setNodeSelection] as const;
}
