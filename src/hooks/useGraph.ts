import { ForceGraphInstance, GraphData } from "force-graph";
import * as React from "react";
import { createGraph } from "../utils/ForceGraphBinding";
import { wrapNewStateForDispatching } from "../utils/general";
import { PreparedData } from "../utils/getData";
import {
  colorByDepth,
  DAGDirections,
  freezeNodeOnDragEnd,
  highlightNodeOnHover,
  renderAsDAG,
  renderNodeAsText,
  selectNodeOnMouseDown,
} from "../utils/graphDecorators";

export function useGraph({
  dagMode,
  renderAsText,
  fixNodeOnDragEnd,
  data,
  width,
  height,
  fixedFontSize,
}: {
  data: PreparedData;
  dagMode: DAGDirections | null;
  renderAsText: boolean;
  fixNodeOnDragEnd: boolean;
  width: number;
  height: number;
  fixedFontSize?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [selectedNodeInState, setSelectedNodeInState] = React.useState<string | null>(null);
  const [graph, setGraph] = React.useState<ReturnType<typeof createGraph> | null>(null);
  const selectedNodeRef = React.useRef<string | null>(null);
  const setNodeSelection = React.useCallback((id: string | null): void => {
    setSelectedNodeInState(id);
    selectedNodeRef.current = id;
  }, []);

  useGraphInstance(ref, setGraph);

  useGraphBasicStyles(graph);

  useGraphSize(graph, width, height);

  const render = React.useMemo(() => {
    if (!graph) return null;

    renderAsDAG(graph, dagMode || null);
    if (fixNodeOnDragEnd) freezeNodeOnDragEnd(graph);
    if (renderAsText) renderNodeAsText(graph, () => selectedNodeRef.current, fixedFontSize);
    else highlightNodeOnHover(graph, data);

    selectNodeOnMouseDown(graph, setNodeSelection);

    // preprocess data for rendering
    const dataMappers: (({ nodes, links }: GraphData) => GraphData)[] = [];
    dataMappers.push(colorByDepth(graph).mapData);
    const dataMapper = (data: GraphData) => dataMappers.reduce((prev, mapper) => mapper(prev), data);

    return (data: GraphData) => graph.graphData(dataMapper(data));
  }, [graph, fixNodeOnDragEnd, dagMode, renderAsText, data, setNodeSelection, fixedFontSize]);

  return [ref, render, selectedNodeInState, setNodeSelection] as const;
}

function useGraphBasicStyles(graph: ForceGraphInstance | null) {
  React.useEffect(() => {
    if (!graph) return;
    graph.nodeId("id").nodeLabel("id").linkDirectionalArrowLength(2);
  }, [graph]);
}

function useGraphInstance(
  ref: React.MutableRefObject<HTMLDivElement | null>,
  setGraph: React.Dispatch<React.SetStateAction<ForceGraphInstance | null>>
) {
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
}

function useGraphSize(graph: ForceGraphInstance | null, width: number, height: number) {
  React.useEffect(() => {
    if (!graph) return;
    graph.width(width).height(height);
  }, [graph, width, height]);
}
