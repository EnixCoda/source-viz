import { DagMode, GraphData } from "force-graph";
import * as React from "react";
import { useMemo } from "react";
import { PreparedData } from "../../utils/graphData";
import { cloneData, ColorByMode, getColorByDataMapper, getNodeId } from "../../utils/graphDataMappers";
import {
  decorateForColorBy,
  freezeNodeOnDragEnd,
  renderAsDAG,
  renderNodeAsText,
  selectNodeOnMouseDown,
} from "../../utils/graphDecorators";
import { useGraphBasicStyles } from "./useGraphBasicStyles";
import { useGraphDecorator } from "./useGraphDecorator";
import { useGraphInstance } from "./useGraphInstance";
import { useGraphSize } from "./useGraphSize";

export function useGraph<E extends HTMLElement>(
  nodeSelection: ReactState<string | null>,
  {
    data,
    fixFontSize,
    fontSize,
    fixNodeOnDragEnd,
    width,
    height,
    enableDagMode,
    dagMode = "lr",
    colorBy = "color-by-depth",
  }: {
    data: PreparedData;
    fixNodeOnDragEnd: boolean;
    fixFontSize: boolean;
    fontSize: number;
    width: number;
    height: number;
    enableDagMode: boolean;
    dagMode?: DagMode | null;
    colorBy?: ColorByMode;
  }
) {
  const selectedNodeRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    selectedNodeRef.current = nodeSelection.value;
  }, [nodeSelection.value]);

  const { ref, graph } = useGraphInstance<E>();
  useGraphBasicStyles(graph);
  useGraphSize(graph, width, height);

  graph?.linkLineDash((link) => {
    const source = getNodeId(link.source);
    const target = getNodeId(link.target);
    const dashLength = 5;
    const gapLength = 5;
    return source !== undefined && target !== undefined && data.asyncRefMap.get(source)?.has(target)
      ? [dashLength, gapLength]
      : [];
  });

  // decorators
  useGraphDecorator(
    graph,
    renderAsDAG,
    useMemo(() => ({ dagMode: enableDagMode ? dagMode : null }), [enableDagMode, dagMode])
  );
  useGraphDecorator(
    graph,
    freezeNodeOnDragEnd,
    useMemo(() => ({}), []),
    fixNodeOnDragEnd
  );
  useGraphDecorator(
    graph,
    renderNodeAsText,
    useMemo(
      () => ({ getSelectionId: () => selectedNodeRef.current, fixFontSize, fontSize, data }),
      [data, fixFontSize, fontSize]
    )
  );
  useGraphDecorator(
    graph,
    selectNodeOnMouseDown,
    useMemo(() => ({ onSelectNode: nodeSelection.setValue }), [nodeSelection.setValue])
  );
  useGraphDecorator(graph, decorateForColorBy, colorBy);

  // data mappers
  const render = React.useMemo(() => {
    const dataMappers: ((data: GraphData) => GraphData)[] = [cloneData, getColorByDataMapper(colorBy)];

    const dataMapper = dataMappers.reduce((prev, cur) => (data) => cur(prev(data)));

    return (data: GraphData) => graph?.graphData(dataMapper(data));
  }, [graph, colorBy]);

  return [ref, render] as const;
}
