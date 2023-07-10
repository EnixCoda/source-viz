import { DagMode, GraphData } from "force-graph";
import * as React from "react";
import { useMemo } from "react";
import { ReactState } from "../../types";
import { PreparedData } from "../../utils/graphData";
import { ColorByMode, cloneData, getColorByDataMapper } from "../../utils/graphDataMappers";
import {
  decorateForColorBy,
  freezeNodeOnDragEnd,
  highlightNodeOnHover,
  renderAsDAG,
  renderNodeAsText,
  selectNodeOnMouseDown,
} from "../../utils/graphDecorators";
import { useGraphBasicStyles } from "./useGraphBasicStyles";
import { useGraphDecorator } from "./useGraphDecorator";
import { useGraphInstance } from "./useGraphInstance";
import { useGraphSize } from "./useGraphSize";

export function useGraph(
  nodeSelection: ReactState<string | null>,
  {
    data,
    renderAsText,
    fixedFontSize,
    fixNodeOnDragEnd,
    width,
    height,
    enableDagMode,
    dagMode = "lr",
    colorBy = "color-by-depth",
  }: {
    data: PreparedData;
    renderAsText: boolean;
    fixNodeOnDragEnd: boolean;
    fixedFontSize?: number;
    width: number;
    height: number;
    enableDagMode: boolean;
    dagMode?: DagMode | null;
    colorBy?: ColorByMode;
  },
) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const selectedNodeRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    selectedNodeRef.current = nodeSelection.value;
  }, [nodeSelection.value]);

  const graph = useGraphInstance(ref);
  useGraphBasicStyles(graph);
  useGraphSize(graph, width, height);

  // decorators
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
    useMemo(() => ({ onSelectNode: nodeSelection.setValue }), [nodeSelection.setValue]),
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
