import * as React from "react";
import { GraphData, GraphViz } from "../../lib/graph-viz";
import { PreparedData } from "../../utils/graphData";
import { ColorByMode } from "../../utils/graphDataMappers";
import { asyncLinkKey } from "../../lib/graph-viz/hit-test";

import type { DagMode, EdgeStyleMode } from "../../lib/graph-viz";

export interface GraphCallbacks {
  onNodeClick?: (nodeId: string, multi: boolean) => void;
  onBackgroundClick?: () => void;
  onNodeContextMenu?: (nodeId: string, screenX: number, screenY: number) => void;
  onBackgroundContextMenu?: (screenX: number, screenY: number) => void;
}

export function useGraph<E extends HTMLElement>(
  {
    data,
    fixFontSize,
    fontSize,
    fixNodeOnDragEnd,
    width,
    height,
    enableDagMode,
    dagMode = "lr",
    colorBy = "color-by-module",
    edgeStyle = "flat",
    cycleLinks,
    selectedNodeIds,
    callbacks,
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
    edgeStyle?: EdgeStyleMode;
    cycleLinks?: Set<string>;
    selectedNodeIds?: Set<string>;
    callbacks: GraphCallbacks;
  }
) {
  const [mountedEl, setMountedEl] = React.useState<E | null>(null);
  const ref = React.useCallback((el: E | null) => {
    setMountedEl(el);
  }, []);

  const graphRef = React.useRef<GraphViz | null>(null);

  // Build async link set from data
  const asyncLinks = React.useMemo(() => {
    const set = new Set<string>();
    for (const [source, targets] of data.asyncRefMap.entries()) {
      for (const target of targets) {
        set.add(asyncLinkKey(source, target));
      }
    }
    return set;
  }, [data.asyncRefMap]);

  // Keep callbacks ref-stable so GraphViz constructor doesn't re-create on every render
  const callbacksRef = React.useRef(callbacks);
  callbacksRef.current = callbacks;

  // Initialize GraphViz instance
  const hasSize = width > 0 && height > 0;
  const pendingDataRef = React.useRef<GraphData | null>(null);

  React.useEffect(() => {
    if (!mountedEl || !hasSize) return;

    const graph = new GraphViz(mountedEl, {
      width,
      height,
      dagMode: enableDagMode ? dagMode : undefined,
      dagLevelDistance: 120,
      fontSize,
      fixFontSize,
      fixNodeOnDragEnd,
      colorBy,
      edgeStyle,
      arrowLength: 4,
      asyncLinks,
      cycleLinks,
      selectedNodeIds,
      dependencyMap: data.dependencyMap,
      dependantMap: data.dependantMap,
      onNodeClick: (id, event) => {
        const isMulti = event.metaKey || event.ctrlKey;
        callbacksRef.current.onNodeClick?.(id, isMulti);
      },
      onNodeDrag: (id) => {
        callbacksRef.current.onNodeClick?.(id, false);
      },
      onBackgroundClick: () => {
        callbacksRef.current.onBackgroundClick?.();
      },
      onNodeContextMenu: (nodeId, screenX, screenY) => {
        callbacksRef.current.onNodeContextMenu?.(nodeId, screenX, screenY);
      },
      onBackgroundContextMenu: (screenX, screenY) => {
        callbacksRef.current.onBackgroundContextMenu?.(screenX, screenY);
      },
    });

    graphRef.current = graph;

    if (pendingDataRef.current) {
      graph.setData(pendingDataRef.current);
    }

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountedEl, hasSize]);

  // Update options reactively
  React.useEffect(() => {
    graphRef.current?.update({
      width,
      height,
      dagMode: enableDagMode ? dagMode : undefined,
      fontSize,
      fixFontSize,
      fixNodeOnDragEnd,
      colorBy,
      edgeStyle,
      arrowLength: 4,
      asyncLinks,
      cycleLinks,
      selectedNodeIds,
      dependencyMap: data.dependencyMap,
      dependantMap: data.dependantMap,
    });
  }, [
    width, height, enableDagMode, dagMode, fontSize, fixFontSize,
    fixNodeOnDragEnd, colorBy, edgeStyle, asyncLinks, cycleLinks, selectedNodeIds,
    data.dependencyMap, data.dependantMap,
  ]);

  // Render function: sets graph data. Buffers if instance not yet ready.
  const render = React.useCallback((graphData: GraphData) => {
    pendingDataRef.current = graphData;
    graphRef.current?.setData(graphData);
  }, []);

  return [ref, render] as const;
}
