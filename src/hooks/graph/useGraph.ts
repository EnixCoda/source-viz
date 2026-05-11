import * as React from "react";
import { GraphData, GraphViz } from "../../lib/graph-viz";
import { PreparedData } from "../../utils/graphData";
import { ColorByMode } from "../../utils/graphDataMappers";
import { asyncLinkKey } from "../../lib/graph-viz/hit-test";

import type { DagMode, EdgeStyleMode } from "../../lib/graph-viz";

export interface GraphCallbacks {
  onNodeClick?: (nodeId: string, multi: boolean) => void;
  onLevelClick?: (nodeIds: string[], multi: boolean) => void;
  onBackgroundClick?: () => void;
  onNodeContextMenu?: (nodeId: string, screenX: number, screenY: number) => void;
  onBackgroundContextMenu?: (screenX: number, screenY: number) => void;
  onNodeHover?: (nodeId: string | null, screenX: number, screenY: number) => void;
  onZoomChange?: (zoom: number) => void;
}

export function useGraph<E extends HTMLElement>(
  {
    data,
    fixFontSize,
    fontSize,
    width,
    height,
    enableDagMode,
    dagMode = "lr",
    colorBy = "color-by-module",
    edgeStyle = "flat",
    cycleLinks,
    selectedNodeIds,
    contextMenuNodeId,
    highlightedNodeIds,
    callbacks,
  }: {
    data: PreparedData;
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
    highlightedNodeIds?: Set<string>;
    contextMenuNodeId?: string | null;
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
      colorBy,
      edgeStyle,
      arrowLength: 4,
      asyncLinks,
      cycleLinks,
      selectedNodeIds,
      highlightedNodeIds,
      dependencyMap: data.dependencyMap,
      dependantMap: data.dependantMap,
      onNodeClick: (id, event) => {
        const isMulti = event.metaKey || event.ctrlKey;
        callbacksRef.current.onNodeClick?.(id, isMulti);
      },
      onLevelClick: (nodeIds, event) => {
        const isMulti = event.metaKey || event.ctrlKey;
        callbacksRef.current.onLevelClick?.(nodeIds, isMulti);
      },
      onNodeHover: (id) => {
        callbacksRef.current.onNodeHover?.(id);
      },
      onZoomChange: (k) => {
        callbacksRef.current.onZoomChange?.(k);
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
      onNodeHover: (nodeId, screenX, screenY) => {
        callbacksRef.current.onNodeHover?.(nodeId, screenX, screenY);
      },
      onZoomChange: (z) => {
        callbacksRef.current.onZoomChange?.(z);
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
      colorBy,
      edgeStyle,
      arrowLength: 4,
      asyncLinks,
      cycleLinks,
      selectedNodeIds,
      contextMenuNodeId,
      highlightedNodeIds,
      dependencyMap: data.dependencyMap,
      dependantMap: data.dependantMap,
    });
  }, [
    width, height, enableDagMode, dagMode, fontSize, fixFontSize,
    colorBy, edgeStyle, asyncLinks, cycleLinks, selectedNodeIds, contextMenuNodeId,
    highlightedNodeIds,
    data.dependencyMap, data.dependantMap,
  ]);

  // Render function: sets graph data. Buffers if instance not yet ready.
  const render = React.useCallback((graphData: GraphData) => {
    pendingDataRef.current = graphData;
    graphRef.current?.setData(graphData);
  }, []);

  const rebuildLayout = React.useCallback(() => {
    graphRef.current?.rebuildLayout();
  }, []);

  return [ref, render, rebuildLayout, graphRef] as const;
}
