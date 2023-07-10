import { DagMode, ForceGraphInstance, GraphData } from "force-graph";
import * as React from "react";
import { useMemo } from "react";
import { createGraph } from "../utils/ForceGraphBinding";
import { wrapNewStateForDispatching } from "../utils/general";
import { PreparedData } from "../utils/getData";
import {
  GraphDecorator,
  freezeNodeOnDragEnd,
  getColorByDataMapper,
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
  const selectedNodeRef = React.useRef<string | null>(null);
  const setNodeSelection = React.useCallback((id: string | null): void => {
    setSelectedNodeInState(id);
    selectedNodeRef.current = id;
  }, []);

  const graph = useGraphInstance(ref);
  useGraphBasicStyles(graph);
  useGraphSize(graph, width, height);

  useGraphDecorator(
    graph,
    renderAsDAG,
    useMemo(() => ({ dagMode: enableDagMode ? dagMode : null }), [enableDagMode, dagMode]),
  );
  useGraphDecorator(
    graph,
    freezeNodeOnDragEnd,
    useMemo(() => ({}), []),
    fixNodeOnDragEnd,
  );
  useGraphDecorator(
    graph,
    renderNodeAsText,
    useMemo(() => ({ getSelection: () => selectedNodeRef.current, fixedFontSize }), [fixedFontSize]),
    renderAsText,
  );
  useGraphDecorator(graph, highlightNodeOnHover, data, !renderAsText);
  useGraphDecorator(
    graph,
    selectNodeOnMouseDown,
    useMemo(() => ({ onSelectNode: setNodeSelection }), [setNodeSelection]),
  );

  const render = React.useMemo(() => {
    if (!graph) return null;

    // preprocess data for rendering
    const dataMappers: (({ nodes, links }: GraphData) => GraphData)[] = [
      // clone data to prevent pollution
      ({ nodes, links }) => ({ nodes: nodes.map((node) => ({ ...node })), links: links.map((link) => ({ ...link })) }),
    ];

    // color by
    dataMappers.push(...(getColorByDataMapper(graph, colorBy) || []));

    const dataMapper = (data: GraphData) => dataMappers.reduce((prev, mapper) => mapper(prev), data);

    return (data: GraphData) => graph.graphData(dataMapper(data));
  }, [graph, colorBy]);

  return [ref, render, selectedNodeInState, setNodeSelection] as const;
}

function useGraphBasicStyles(graph: ForceGraphInstance | null) {
  React.useEffect(() => {
    if (!graph) return;
    graph.nodeId("id").nodeLabel("id").linkDirectionalArrowLength(2);
  }, [graph]);
}

function useGraphInstance(ref: React.MutableRefObject<HTMLDivElement | null>) {
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

function useGraphSize(graph: ForceGraphInstance | null, width: number, height: number) {
  React.useEffect(() => {
    if (!graph) return;
    graph.width(width).height(height);
  }, [graph, width, height]);
}

function useGraphDecorator<T>(
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
