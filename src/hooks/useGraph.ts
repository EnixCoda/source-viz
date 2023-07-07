import { DagMode, ForceGraphInstance, GraphData } from "force-graph";
import * as React from "react";
import { createGraph } from "../utils/ForceGraphBinding";
import { wrapNewStateForDispatching } from "../utils/general";
import { PreparedData } from "../utils/getData";
import {
  colorByDepth,
  colorByHeat,
  freezeNodeOnDragEnd,
  highlightNodeOnHover,
  renderAsDAG,
  renderNodeAsText,
  selectNodeOnMouseDown,
} from "../utils/graphDecorators";

export function useGraph({
  data,
  renderAsText,
  fixedFontSize,
  fixNodeOnDragEnd,
  width,
  height,
  enableDagMode,
  dagMode = "lr",
  colorBy = "depth",
}: {
  data: PreparedData;
  renderAsText: boolean;
  fixNodeOnDragEnd: boolean;
  fixedFontSize?: number;
  width: number;
  height: number;
  enableDagMode: boolean;
  dagMode?: DagMode | null;
  colorBy?: "depth" | "connection-both" | "connection-dependency" | "connection-dependant";
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

    renderAsDAG(graph, enableDagMode ? dagMode : null);
    if (fixNodeOnDragEnd) freezeNodeOnDragEnd(graph);
    if (renderAsText) renderNodeAsText(graph, () => selectedNodeRef.current, fixedFontSize);
    else highlightNodeOnHover(graph, data);

    selectNodeOnMouseDown(graph, setNodeSelection);

    // preprocess data for rendering
    const dataMappers: (({ nodes, links }: GraphData) => GraphData)[] = [];

    // color by
    switch (colorBy) {
      case "depth": {
        dataMappers.push(colorByDepth(graph).mapData);
        break;
      }
      case "connection-both":
      case "connection-dependency":
      case "connection-dependant": {
        dataMappers.push(
          colorByHeat(
            graph,
            (
              {
                "connection-both": "both",
                "connection-dependency": "source",
                "connection-dependant": "target",
              } as const
            )[colorBy],
          ).mapData,
        );
        break;
      }
    }

    const dataMapper = (data: GraphData) => dataMappers.reduce((prev, mapper) => mapper(prev), data);

    return (data: GraphData) => graph.graphData(dataMapper(data));
  }, [graph, fixNodeOnDragEnd, enableDagMode, dagMode, renderAsText, data, setNodeSelection, fixedFontSize, colorBy]);

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
  setGraph: React.Dispatch<React.SetStateAction<ForceGraphInstance | null>>,
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
