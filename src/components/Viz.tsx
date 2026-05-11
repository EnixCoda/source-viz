import { Box, ButtonGroup, Divider, HStack, Heading, IconButton, Text, Tooltip, VStack } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import {
  SearchIcon,
  InfoOutlineIcon,
  SettingsIcon,
  ViewIcon,
  RepeatClockIcon,
  StarIcon,
} from "@chakra-ui/icons";
import * as React from "react";
import { useWindowSize } from "react-use";
import { useGraph, GraphCallbacks } from "../hooks/graph/useGraph";
import { useClampedSize } from "../hooks/useClampedSize";
import { useObserveElementSize } from "../hooks/useObserveElementSize";
import { Size2D, useResizeHandler } from "../hooks/useResizeHandler";
import { useSet } from "../hooks/useSet";
import { useCheckboxView } from "../hooks/view/useCheckboxView";
import { useNumberInputView } from "../hooks/view/useInputView";
import { useRadioGroupView } from "../hooks/view/useRadioGroupView";
import { useRegExpInputView } from "../hooks/view/useRegExpInputView";
import { useSelectView } from "../hooks/view/useSelectView";
import { useSwitchView } from "../hooks/view/useSwitchView";
import { DependencyEntry } from "../services/serializers";
import { carry } from "../utils/general";
import { GraphMode, filterGraphData, prepareGraphData } from "../utils/graphData";
import { ColorByMode } from "../utils/graphDataMappers";
import { EdgeStyleMode } from "../lib/graph-viz";
import { ActiveFilter, ActiveFiltersBar } from "./ActiveFiltersBar";
import { CommandPalette, PaletteAction } from "./CommandPalette";
import { DockDef, DockId, DockRail } from "./DockRail";
import { ExportButton } from "./ExportButton";
import { FormSwitch } from "./FormSwitch";
import { HorizontalResizeHandler } from "./HorizontalResizeHandler";
import { InvestigatePanel } from "./UsageInvestigator/InvestigatePanel";
import { InvestigatorFs } from "../lib/usage-investigator";
import { ListOfNodeList } from "./ListOfNodeList";
import { Minimap } from "./Minimap";
import { NodeHoverCard } from "./NodeHoverCard";
import { NodeInspector } from "./NodeInspector";
import { NodeList } from "./NodeList";
import { NodesFilter } from "./NodesFilter";
import { SettingsOfOpenInVSCode } from "./OpenInVSCode";
import { EntriesTable } from "./Scan/EntriesTable";
import { StatusBar } from "./StatusBar";
import { ZoomHUD } from "./ZoomHUD";
import { ArrowBackIcon, RepeatIcon } from "@chakra-ui/icons";

const DOCK_LABELS: Record<string, string> = {
  inspector: "Inspector",
  roots: "Entry points",
  leaves: "Leaf files",
  filters: "Filters",
  lookup: "Look up",
  cycles: "Cycles",
  settings: "Settings",
};

export function Viz({
  entries,
  onBack,
  onRescan,
  investigatorFs = null,
}: {
  entries: DependencyEntry[];
  setData: (entries: DependencyEntry[]) => void;
  onBack?: () => void;
  onRescan?: () => void;
  /**
   * Filesystem reader used by the usage investigator. Pass `null` to disable
   * the investigator UI. Live "Browse" sessions wrap a `FileSystemDirectoryHandle`;
   * demo / restored sessions wrap an in-memory `Record<file, source>`. Both
   * implementations conform to the same `InvestigatorFs` interface.
   */
  investigatorFs?: InvestigatorFs | null;
}) {
  const data = React.useMemo(() => {
    const t0 = performance.now();
    const result = prepareGraphData(entries);
    console.log(`[Viz] prepareGraphData: ${(performance.now() - t0).toFixed(1)}ms, nodes=${result.nodes.size}`);
    return result;
  }, [entries]);
  const allNodes = React.useMemo(() => [...data.nodes.keys()].sort(), [data.nodes]);

  // Excludes
  const [excludeNodesFilterInputView, excludeNodesFilterRegExp, excludeNodesFilterInput, resetExcludeNodesFilter] = useRegExpInputView({
    helperText: "Nodes match this regex will be excluded",
  });
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? allNodes.filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [excludeNodesFilterRegExp, allNodes]
  );
  const [excludedNodes, toggleExcludeNode, , clearExcludedNodes] = useSet<string>();
  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedNodes]),
    [excludedNodesFromInput, excludedNodes]
  );
  const nonExcludedNodes = React.useMemo(
    () => allNodes.filter((id) => !allExcludedNodes.has(id)),
    [allNodes, allExcludedNodes]
  );

  // Restrictions
  const [restrictRootInputView, restrictRootsRegExp, restrictRootsInput, resetRestrictRoots] = useRegExpInputView({
    inputProps: { placeholder: "Filter nodes with RegExp" },
    helperText: "Only nodes match this regex will be regarded as roots.",
  });
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        carry(nonExcludedNodes, (ns) => (restrictRootsRegExp ? ns.filter((id) => id.match(restrictRootsRegExp)) : ns))
      ),
    [nonExcludedNodes, restrictRootsRegExp]
  );
  const [restrictLeavesInputView, restrictLeavesRegExp, restrictLeavesInput, resetRestrictLeaves] = useRegExpInputView({
    inputProps: { placeholder: "Filter nodes with RegExp" },
    helperText: "Only nodes match this regex will be regarded as leave.",
  });
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        carry(nonExcludedNodes, (ns) => (restrictLeavesRegExp ? ns.filter((id) => id.match(restrictLeavesRegExp)) : ns))
      ),
    [nonExcludedNodes, restrictLeavesRegExp]
  );

  // Graph
  // Detect cycles independently of graphMode/separateAsyncImports so we can
  // disable "cycles-only" when there are none, before the select view is set up.
  const hasCycles = React.useMemo(() => {
    const result = filterGraphData(data, {
      roots: restrictedRoots,
      leave: restrictedLeaves,
      excludes: allExcludedNodes,
      graphMode: "natural",
      separateAsyncImports: false,
    });
    return result.cycles.length > 0;
  }, [data, restrictedRoots, restrictedLeaves, allExcludedNodes]);

  const [graphModeView, graphMode, setGraphMode] = useSelectView<GraphMode>(
    {
      label: "Graph Mode",
      defaultValue: "dag",
      helperText: !hasCycles ? "No cycles detected — \"Cycles Only\" is unavailable." : undefined,
    },
    [
      { value: "dag", label: "DAG (Directed Acyclic Graph, all nodes, no cycle)" },
      { value: "natural", label: "Natural (all nodes, allow cycles)" },
      { value: "cycles-only", label: `Cycles Only (only nodes on cycles)`, disabled: !hasCycles },
    ]
  );

  // Auto-switch away from "cycles-only" if there are no cycles in the current data
  React.useEffect(() => {
    if (graphMode === "cycles-only" && !hasCycles) {
      setGraphMode("natural");
    }
  }, [graphMode, hasCycles, setGraphMode]);

  const [colorByView, colorBy] = useSelectView<ColorByMode>(
    {
      label: "Color nodes by",
      defaultValue: "color-by-module",
    },
    [
      { value: "color-by-module", label: "Module" },
      { value: "color-by-depth", label: "File depth" },
      { value: "color-by-connections", label: "Connections" },
      { value: "color-by-imported-by", label: "Imported by" },
      { value: "color-by-imports", label: "Imports" },
    ]
  );
  const [edgeStyleView, edgeStyle] = useSelectView<EdgeStyleMode>(
    {
      label: "Edge style",
      defaultValue: "flat",
    },
    [
      { value: "flat", label: "Flat (colored by source)" },
      { value: "tapered", label: "Tapered (wide→narrow shows direction)" },
      { value: "gradient", label: "Gradient (source→target color)" },
      { value: "highlight-cycles", label: "Highlight cycles (red)" },
    ]
  );
  const [separateAsyncImportsView, separateAsyncImports] = useCheckboxView({
    label: "Cut-off async imports",
    defaultValue: false,
  });
  const fixFontSize = false;
  const [fontSizeView, fontSize = 12] = useNumberInputView({
    label: "Font Size",
    defaultValue: 12,
    inputProps: {
      keepWithinRange: true,
      clampValueOnBlur: true,
      min: 1,
    },
  });

  const [vizModeView, vizMode, setVizMode] = useRadioGroupView(
    "Viz Mode",
    [
      { value: "graph", label: "Graph" },
      { value: "table", label: "Table" },
      { value: "split", label: "Split" },
    ],
    {
      defaultValue: "graph",
      formControlProps: {
        width: "auto",
      },
      row: true,
    }
  );

  // handling resize
  const [preferredSize, setSize] = React.useState<Size2D>(() => [window.innerWidth / 2, window.innerHeight]);
  const { onPointerDown } = useResizeHandler(preferredSize, setSize);
  const windowSize = useWindowSize();
  const sizeLimit = React.useMemo(() => {
    const minimumWidth = 200;
    const minimumRemainWidth = 300;
    return {
      width: {
        min: minimumWidth,
        max: windowSize.width - minimumRemainWidth,
      },
    };
  }, [windowSize.width]);
  const [width] = useClampedSize(preferredSize, sizeLimit);

  const [vizContainerRef, vizContainerSize] = useObserveElementSize();

  const graphData = React.useMemo(() => {
    const t0 = performance.now();
    const result = filterGraphData(data, {
      roots: restrictedRoots,
      leave: restrictedLeaves,
      excludes: allExcludedNodes,
      graphMode,
      separateAsyncImports,
    });
    console.log(`[Viz] filterGraphData: ${(performance.now() - t0).toFixed(1)}ms, nodes=${result.nodes.length}, links=${result.links.length}, cycles=${result.cycles.length}`);
    return result;
  }, [data, restrictedRoots, restrictedLeaves, graphMode, allExcludedNodes, separateAsyncImports]);

  const cycleLinks = React.useMemo(() => {
    const set = new Set<string>();
    for (const cycle of graphData.cycles) {
      for (let i = 0; i < cycle.length; i++) {
        const src = cycle[i];
        const tgt = cycle[(i + 1) % cycle.length];
        set.add(`${src}->${tgt}`);
      }
    }
    return set;
  }, [graphData.cycles]);

  // Multi-select state
  const [selectedNodes, setSelectedNodes] = React.useState<Set<string>>(new Set());
  const selectedNode = selectedNodes.size === 1 ? [...selectedNodes][0] : null;

  const setSelectedNode = React.useCallback((id: string | null) => {
    setSelectedNodes(id ? new Set([id]) : new Set());
  }, []);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

  const closeContextMenu = React.useCallback(() => setContextMenu(null), []);

  // Hover tooltip state
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [zoomScale, setZoomScale] = React.useState(1);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  // Show tooltip when text is too small to read comfortably (zoom < 0.6)
  const showTooltip = hoveredNodeId !== null && zoomScale < 0.6;

  // Usage investigator state
  const [investigateTarget, setInvestigateTarget] = React.useState<{ file: string; symbol?: string | null } | null>(null);
  const [highlightedFiles, setHighlightedFiles] = React.useState<Set<string> | null>(null);
  const knownFiles = React.useMemo(() => new Set(data.nodes.keys()), [data.nodes]);

  // Close context menu on scroll or click outside
  React.useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") handler(); });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [contextMenu]);

  // Hover state for the hover card (canvas → screen coords)
  const [hover, setHover] = React.useState<{ nodeId: string; x: number; y: number } | null>(null);
  // Zoom state mirrored from GraphViz for the HUD
  const [zoom, setZoom] = React.useState(1);

  const graphCallbacks = React.useMemo<GraphCallbacks>(() => ({
    onNodeClick: (id, multi) => {
      closeContextMenu();
      if (multi) {
        setSelectedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else {
        setSelectedNodes(new Set([id]));
      }
    },
    onLevelClick: (nodeIds, multi) => {
      closeContextMenu();
      if (multi) {
        setSelectedNodes((prev) => {
          const next = new Set(prev);
          for (const id of nodeIds) {
            if (next.has(id)) next.delete(id);
            else next.add(id);
          }
          return next;
        });
      } else {
        setSelectedNodes(new Set(nodeIds));
      }
    },
    onBackgroundClick: () => {
      closeContextMenu();
      setSelectedNodes(new Set());
    },
    onNodeContextMenu: (nodeId, screenX, screenY) => {
      setContextMenu({ x: screenX, y: screenY, nodeId });
    },
    onBackgroundContextMenu: (screenX, screenY) => {
      setContextMenu({ x: screenX, y: screenY, nodeId: null });
    },
    onNodeHover: (nodeId, screenX, screenY) => {
      if (nodeId) setHover({ nodeId, x: screenX, y: screenY });
      else setHover(null);
    },
    onZoomChange: (z) => setZoom(z),
  }), [closeContextMenu]);

  const [ref, render, rebuildLayout, graphRef] = useGraph<HTMLDivElement>(
    {
      data,
      fixFontSize,
      fontSize,
      width: vizContainerSize?.width || 0,
      height: vizContainerSize?.height || 0,
      enableDagMode: graphMode === "dag",
      colorBy,
      edgeStyle,
      cycleLinks,
      selectedNodeIds: selectedNodes.size > 0 ? selectedNodes : undefined,
      contextMenuNodeId: contextMenu?.nodeId ?? null,
      highlightedNodeIds: highlightedFiles ?? undefined,
      callbacks: graphCallbacks,
    }
  );

  const [layoutStale, setLayoutStale] = React.useState(false);
  const prevGraphDataRef = React.useRef<typeof graphData | null>(null);
  React.useEffect(() => {
    render?.(graphData);
    const isInitial = prevGraphDataRef.current === null;
    prevGraphDataRef.current = graphData;
    if (!isInitial && graphMode === "dag") {
      setLayoutStale(true);
    }
  }, [render, graphData, graphMode]);

  React.useEffect(() => {
    // Reset stale flag when DAG mode is turned off (no DAG layout to rebuild)
    if (graphMode !== "dag") setLayoutStale(false);
  }, [graphMode]);

  const handleRebuildLayout = React.useCallback(() => {
    rebuildLayout();
    setLayoutStale(false);
  }, [rebuildLayout]);

  const [nodeSelectionHistory, setNodeSelectionHistory] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (selectedNodes.size > 0) {
      setNodeSelectionHistory((history) => {
        const newNodes = [...selectedNodes].filter((n) => !history.includes(n));
        return [...newNodes, ...history.filter((n) => !selectedNodes.has(n))];
      });
    }
  }, [selectedNodes]);

  // Cursor for prev/next navigation through history without mutating it
  const [historyOffset, setHistoryOffset] = React.useState(0);
  React.useEffect(() => { setHistoryOffset(0); }, [selectedNodes]);

  // The in-views
  const [inViewView, inView, setInView] = useSwitchView({
    label: "Hide nodes not rendered in viz",
    defaultValue: true,
  });
  const renderedNodes = React.useMemo(() => graphData?.nodes.map((node) => node.id), [graphData.nodes]);
  const kindMap = React.useMemo(
    () => new Map(graphData.nodes.map((n) => [n.id, n.kind])),
    [graphData.nodes]
  );
  const links = graphData.links;

  // Build sets once (O(m)) then use O(1) membership instead of O(n×m) links.every()
  const { sourcesSet, targetsSet } = React.useMemo(() => {
    const sourcesSet = new Set<string>();
    const targetsSet = new Set<string>();
    for (const { source, target } of links) {
      sourcesSet.add(source);
      targetsSet.add(target);
    }
    return { sourcesSet, targetsSet };
  }, [links]);

  const leavesInView = React.useMemo(
    () => renderedNodes.filter((id) => !sourcesSet.has(id) && targetsSet.has(id)),
    [renderedNodes, sourcesSet, targetsSet]
  );
  const rootsInView = React.useMemo(
    () => renderedNodes.filter((id) => !targetsSet.has(id) && sourcesSet.has(id)),
    [renderedNodes, sourcesSet, targetsSet]
  );

  const renderedNodesSet = React.useMemo(() => new Set(renderedNodes), [renderedNodes]);
  const renderedEntries = React.useMemo(
    () =>
      entries
        .filter(([entry]) => renderedNodesSet.has(entry))
        .map(([entry, dependencies]) => [
          entry,
          dependencies.filter(([dependency]) => renderedNodesSet.has(dependency)),
        ]) satisfies DependencyEntry[],
    [entries, renderedNodesSet]
  );

  // Dock state
  const [dockId, setDockId] = React.useState<DockId | null>("inspector");
  // Auto-open inspector when a new selection happens
  React.useEffect(() => {
    if (selectedNodes.size > 0 && dockId === null) {
      setDockId("inspector");
    }
    // intentionally not depending on dockId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodes]);

  const dockDefs = React.useMemo<DockDef[]>(
    () => [
      { id: "inspector", label: "Inspector", icon: <InfoOutlineIcon />, badge: selectedNodes.size || undefined },
      { id: "lookup", label: "Look up nodes", icon: <SearchIcon /> },
      { id: "roots", label: "Entry points", icon: <StarIcon /> },
      { id: "leaves", label: "Leaf files", icon: <ViewIcon /> },
      { id: "filters", label: "Filters & exclusions", icon: <RepeatClockIcon />, badge: excludedNodes.length || undefined },
      { id: "cycles", label: "Cycles", icon: <RepeatIcon />, badge: graphData.cycles.length || undefined },
      { id: "settings", label: "Settings", icon: <SettingsIcon /> },
    ],
    [selectedNodes.size, excludedNodes.length, graphData.cycles.length]
  );

  // Active filters chip bar
  const activeFilters = React.useMemo<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (excludeNodesFilterInput) {
      list.push({
        id: "exclude-regex",
        label: "exclude",
        value: excludeNodesFilterInput,
        tooltip: `Regex-excluded ${excludedNodesFromInput.length} nodes`,
        onRemove: resetExcludeNodesFilter,
      });
    }
    if (restrictRootsInput) {
      list.push({
        id: "roots-regex",
        label: "roots",
        value: restrictRootsInput,
        tooltip: "Restrict roots regex",
        onRemove: resetRestrictRoots,
      });
    }
    if (restrictLeavesInput) {
      list.push({
        id: "leaves-regex",
        label: "leaves",
        value: restrictLeavesInput,
        tooltip: "Restrict leaves regex",
        onRemove: resetRestrictLeaves,
      });
    }
    if (excludedNodes.length > 0) {
      list.push({
        id: "manual-excludes",
        label: "−nodes",
        value: String(excludedNodes.length),
        tooltip: `${excludedNodes.length} manually excluded node(s)`,
        onRemove: clearExcludedNodes,
      });
    }
    if (graphMode && graphMode !== "dag") {
      list.push({ id: "mode", label: "mode", value: graphMode, onRemove: () => setGraphMode("dag") });
    }
    if (separateAsyncImports) {
      list.push({ id: "async-cut", label: "async", value: "cut", tooltip: "Async imports excluded from graph" });
    }
    return list;
  }, [
    excludeNodesFilterInput,
    excludedNodesFromInput.length,
    resetExcludeNodesFilter,
    restrictRootsInput,
    resetRestrictRoots,
    restrictLeavesInput,
    resetRestrictLeaves,
    excludedNodes.length,
    clearExcludedNodes,
    graphMode,
    setGraphMode,
    separateAsyncImports,
  ]);

  const clearAllFilters = React.useCallback(() => {
    resetExcludeNodesFilter();
    resetRestrictRoots();
    resetRestrictLeaves();
    clearExcludedNodes();
    setGraphMode("dag");
  }, [resetExcludeNodesFilter, resetRestrictRoots, resetRestrictLeaves, clearExcludedNodes, setGraphMode]);

  // Command palette + keyboard shortcuts
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const paletteActions = React.useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      { id: "fit", label: "Fit graph to view", group: "action", hint: "f", run: () => graphRef.current?.fitToView() },
      { id: "reset", label: "Reset zoom", group: "action", run: () => graphRef.current?.resetView() },
      { id: "zoom-in", label: "Zoom in", group: "action", run: () => graphRef.current?.zoomBy(1.4) },
      { id: "zoom-out", label: "Zoom out", group: "action", run: () => graphRef.current?.zoomBy(1 / 1.4) },
      { id: "screenshot", label: "Take screenshot", group: "action", run: () => {
          const url = graphRef.current?.toDataURL();
          if (!url) return;
          const a = document.createElement("a");
          a.href = url; a.download = `source-viz-${Date.now()}.png`; a.click();
        } },
      { id: "rebuild", label: "Rebuild layout", group: "action", run: handleRebuildLayout },
      { id: "clear-selection", label: "Clear selection", group: "action", run: () => setSelectedNodes(new Set()) },
      { id: "clear-excludes", label: "Clear manual excludes", group: "action", run: () => clearExcludedNodes() },
      { id: "clear-filters", label: "Clear all filters", group: "action", run: clearAllFilters },
      { id: "dock-inspector", label: "Open: Inspector", group: "action", run: () => setDockId("inspector") },
      { id: "dock-cycles", label: "Open: Cycles", group: "action", hint: `${graphData.cycles.length}`, run: () => setDockId("cycles") },
      { id: "dock-filters", label: "Open: Filters", group: "action", run: () => setDockId("filters") },
      { id: "dock-roots", label: "Open: Entry points", group: "action", run: () => setDockId("roots") },
      { id: "dock-leaves", label: "Open: Leaf files", group: "action", run: () => setDockId("leaves") },
      { id: "dock-settings", label: "Open: Settings", group: "action", run: () => setDockId("settings") },
      { id: "dock-lookup", label: "Open: Look up", group: "action", run: () => setDockId("lookup") },
      { id: "mode-graph", label: "View: Graph only", group: "action", run: () => setVizMode("graph") },
      { id: "mode-table", label: "View: Table only", group: "action", run: () => setVizMode("table") },
      { id: "mode-split", label: "View: Split (graph + table)", group: "action", run: () => setVizMode("split") },
    ];
    // Node actions: pick & focus
    for (const n of allNodes) {
      actions.push({
        id: `node:${n}`,
        label: n,
        group: "node",
        keywords: n,
        run: () => {
          setSelectedNode(n);
          setDockId("inspector");
        },
      });
    }
    return actions;
  }, [graphRef, handleRebuildLayout, clearExcludedNodes, clearAllFilters, graphData.cycles.length, allNodes, setSelectedNode, setVizMode]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Cmd/Ctrl+K — always opens palette, even from inputs
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
        return;
      }

      if (inEditable) return;

      if (e.key === "Escape") {
        if (paletteOpen) return;
        setSelectedNodes(new Set());
        setContextMenu(null);
      } else if (e.key === "f") {
        e.preventDefault();
        graphRef.current?.fitToView();
      } else if (e.key === "r") {
        e.preventDefault();
        graphRef.current?.resetView();
      } else if (e.key === "i") {
        e.preventDefault();
        setDockId("inspector");
      } else if (e.key === "e" && selectedNodes.size > 0) {
        e.preventDefault();
        selectedNodes.forEach((id) => toggleExcludeNode(id));
        setSelectedNodes(new Set());
      } else if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [graphRef, paletteOpen, selectedNodes, toggleExcludeNode]);

  return (
    <HStack display="inline-flex" alignItems="stretch" spacing={0} maxHeight="100%" height="100vh">
      <VStack alignItems="stretch" height="100vh" width={width} spacing={0}>
        <HStack justifyContent="space-between" px={2} py={1} flexShrink={0}>
          <ButtonGroup size="xs" variant="ghost" spacing={0.5}>
            <Tooltip label="Back" hasArrow openDelay={300}>
              <IconButton aria-label="Back" icon={<ArrowBackIcon />} onClick={onBack} />
            </Tooltip>
            {onRescan && (
              <Tooltip label="Re-scan project" hasArrow openDelay={300}>
                <IconButton aria-label="Re-scan" icon={<RepeatIcon />} onClick={onRescan} />
              </Tooltip>
            )}
          </ButtonGroup>
          <Box transform="scale(0.85)" transformOrigin="right center">
            {vizModeView}
          </Box>
        </HStack>
        <ActiveFiltersBar filters={activeFilters} onClearAll={clearAllFilters} />
        <Divider height="auto" />
        <Box ref={vizContainerRef} flex={1} overflowY="auto" position="relative" minH={0}>
          <Box
            display={vizMode === "table" ? "none" : "flex"}
            flexDirection="column"
            height={vizMode === "split" ? "60%" : "100%"}
            position="relative"
          >
            <div ref={ref} style={{ flex: 1, minHeight: 0 }} />
            {vizMode !== "table" && (
              <>
                <ZoomHUD
                  zoom={zoom}
                  onZoomIn={() => graphRef.current?.zoomBy(1.4)}
                  onZoomOut={() => graphRef.current?.zoomBy(1 / 1.4)}
                  onFit={() => graphRef.current?.fitToView()}
                  onReset={() => graphRef.current?.resetView()}
                  onScreenshot={() => {
                    const url = graphRef.current?.toDataURL();
                    if (!url) return;
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `source-viz-${Date.now()}.png`;
                    a.click();
                  }}
                  onRebuildLayout={graphMode === "dag" ? handleRebuildLayout : undefined}
                  layoutStale={layoutStale}
                />
                <Minimap graphRef={graphRef} refreshKey={graphData.nodes.length + selectedNodes.size} />
                {hover && !contextMenu && (
                  <NodeHoverCard
                    nodeId={hover.nodeId}
                    screenX={hover.x}
                    screenY={hover.y}
                    inCount={data.dependantMap.get(hover.nodeId)?.size ?? 0}
                    outCount={data.dependencyMap.get(hover.nodeId)?.size ?? 0}
                    onCycle={graphData.cycles.some((c) => c.includes(hover.nodeId))}
                    importsPreview={[...(data.dependencyMap.get(hover.nodeId) ?? [])].slice(0, 5)}
                    importedByPreview={[...(data.dependantMap.get(hover.nodeId) ?? [])].slice(0, 5)}
                  />
                )}
              </>
            )}
          </Box>
          {(vizMode === "table" || vizMode === "split") && (
            <Box
              flex={vizMode === "split" ? "0 0 40%" : 1}
              height={vizMode === "split" ? "40%" : "100%"}
              overflowY="auto"
              borderTop={vizMode === "split" ? "1px solid" : undefined}
              borderColor="gray.200"
            >
              <EntriesTable entries={renderedEntries} onClickSelect={setSelectedNode} />
            </Box>
          )}
          {contextMenu && (
            <Box
              position="fixed"
              left={contextMenu.x}
              top={contextMenu.y}
              zIndex={1000}
              bg="white"
              shadow="lg"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
              py={1}
              minW="200px"
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.nodeId ? (
                <VStack alignItems="stretch" spacing={0}>
                  <Text px={3} py={1} fontSize="xs" color="gray.500" fontWeight="bold">
                    {contextMenu.nodeId.length > 40
                      ? "…" + contextMenu.nodeId.slice(-39)
                      : contextMenu.nodeId}
                  </Text>
                  <Divider />
                  <ContextMenuItem onClick={() => {
                    setSelectedNodes((prev) => {
                      const next = new Set(prev);
                      if (next.has(contextMenu.nodeId!)) next.delete(contextMenu.nodeId!);
                      else next.add(contextMenu.nodeId!);
                      return next;
                    });
                    closeContextMenu();
                  }}>
                    {selectedNodes.has(contextMenu.nodeId) ? "Deselect" : "Select"}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => { toggleExcludeNode(contextMenu.nodeId!); closeContextMenu(); }}>
                    {allExcludedNodes.has(contextMenu.nodeId) ? "Include in viz" : "Exclude from viz"}
                  </ContextMenuItem>
                  <ContextMenuItem
                    isDisabled={!investigatorFs}
                    title={!investigatorFs ? "Source files are not available for this dataset" : undefined}
                    onClick={() => {
                      setInvestigateTarget({ file: contextMenu.nodeId! });
                      closeContextMenu();
                    }}
                  >
                    Investigate export…
                  </ContextMenuItem>
                  {data.dependencyMap.get(contextMenu.nodeId)?.size ? (
                    <ContextMenuItem onClick={() => {
                      data.dependencyMap.get(contextMenu.nodeId!)?.forEach((dep) => {
                        if (!allExcludedNodes.has(dep)) toggleExcludeNode(dep);
                      });
                      closeContextMenu();
                    }}>
                      Exclude imports ({data.dependencyMap.get(contextMenu.nodeId)?.size})
                    </ContextMenuItem>
                  ) : null}
                  {data.dependantMap.get(contextMenu.nodeId)?.size ? (
                    <ContextMenuItem onClick={() => {
                      data.dependantMap.get(contextMenu.nodeId!)?.forEach((dep) => {
                        if (!allExcludedNodes.has(dep)) toggleExcludeNode(dep);
                      });
                      closeContextMenu();
                    }}>
                      Exclude importers ({data.dependantMap.get(contextMenu.nodeId)?.size})
                    </ContextMenuItem>
                  ) : null}
                  {selectedNodes.size > 1 && (
                    <>
                      <Divider />
                      <ContextMenuItem onClick={() => {
                        selectedNodes.forEach((id) => {
                          if (!allExcludedNodes.has(id)) toggleExcludeNode(id);
                        });
                        setSelectedNodes(new Set());
                        closeContextMenu();
                      }}>
                        Exclude all selected ({selectedNodes.size})
                      </ContextMenuItem>
                    </>
                  )}
                </VStack>
              ) : (
                <VStack alignItems="stretch" spacing={0}>
                  {selectedNodes.size > 0 && (
                    <ContextMenuItem onClick={() => { setSelectedNodes(new Set()); closeContextMenu(); }}>
                      Deselect {selectedNodes.size > 1 ? `all (${selectedNodes.size})` : ""}
                    </ContextMenuItem>
                  )}
                  {selectedNodes.size === 0 && (
                    <Text px={3} py={2} fontSize="sm" color="gray.400">No actions</Text>
                  )}
                </VStack>
              )}
            </Box>
          )}
        </Box>
        <StatusBar
          totalFiles={data.nodes.size}
          renderedNodes={graphData.nodes.length}
          renderedEdges={graphData.links.length}
          cycles={graphData.cycles.length}
          selected={selectedNodes.size}
          graphMode={graphMode ?? "dag"}
          asyncCutoff={separateAsyncImports}
          layoutStale={layoutStale && vizMode !== "table"}
        />
      </VStack>
      <HorizontalResizeHandler onPointerDown={onPointerDown} />
      <HStack alignItems="stretch" height="100vh" flex={1} minW={0} spacing={0}>
        <Box flex={1} minW={0} overflow="hidden" display="flex" flexDirection="column">
          {dockId && (
            <>
              <HStack
                px={2}
                py={1}
                bg="gray.50"
                borderBottom="1px solid"
                borderColor="gray.200"
                flexShrink={0}
                justifyContent="space-between"
              >
                <Heading as="h2" size="xs" color="gray.700">
                  {DOCK_LABELS[dockId] ?? dockId}
                </Heading>
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label="Close panel"
                  icon={<ChevronRightIcon />}
                  onClick={() => setDockId(null)}
                />
              </HStack>
              <Box flex={1} overflow="auto" minH={0} px={2} py={2}>
                {dockId === "inspector" && (
                  <NodeInspector
                    selectedNodes={selectedNodes}
                    selectedNode={selectedNode}
                    data={data}
                    renderedNodes={renderedNodes}
                    kindMap={kindMap}
                    nodeSelectionHistory={nodeSelectionHistory}
                    historyOffset={historyOffset}
                    setHistoryOffset={setHistoryOffset}
                    setSelectedNode={setSelectedNode}
                    setSelectedNodes={setSelectedNodes}
                    allExcludedNodes={allExcludedNodes}
                    toggleExcludeNode={toggleExcludeNode}
                    investigatorFs={investigatorFs}
                    setInvestigateTarget={setInvestigateTarget}
                  />
                )}
                {dockId === "roots" && (
                  <VStack alignItems="flex-start" spacing={2}>
                    <Tooltip
                      label="Files that import others but are not imported by anything — entry points / roots of the graph."
                      hasArrow
                      placement="top-start"
                    >
                      <Text fontSize="xs" color="gray.500" cursor="help" textDecoration="underline" textDecorationStyle="dotted">
                        What are entry points?
                      </Text>
                    </Tooltip>
                    {restrictRootInputView}
                    <FormSwitch
                      label="Hide nodes not rendered as entry point"
                      inputProps={{ isDisabled: restrictRootsRegExp === null }}
                      value={restrictRootsRegExp === null || inView}
                      onChange={() => setInView(!inView)}
                    />
                    <NodeList
                      nodes={restrictRootsRegExp === null || inView ? rootsInView : [...restrictedRoots]}
                      kindMap={kindMap}
                      mapProps={(id) => ({
                        onExclude: () => toggleExcludeNode(id),
                        onSelect: () => setSelectedNode(id),
                      })}
                    />
                  </VStack>
                )}
                {dockId === "leaves" && (
                  <VStack alignItems="flex-start" spacing={2}>
                    <Tooltip
                      label="Files imported by others but importing nothing — utilities, types, constants, or 3rd party packages."
                      hasArrow
                      placement="top-start"
                    >
                      <Text fontSize="xs" color="gray.500" cursor="help" textDecoration="underline" textDecorationStyle="dotted">
                        What are leaf files?
                      </Text>
                    </Tooltip>
                    {restrictLeavesInputView}
                    <FormSwitch
                      label="Hide nodes not rendered as leaf"
                      inputProps={{ isDisabled: restrictLeavesRegExp === null }}
                      value={restrictLeavesRegExp === null || inView}
                      onChange={() => setInView(!inView)}
                    />
                    <NodeList
                      nodes={restrictLeavesRegExp === null || inView ? leavesInView : [...restrictedLeaves]}
                      kindMap={kindMap}
                      mapProps={(id) => ({
                        onExclude: () => toggleExcludeNode(id),
                        onSelect: () => setSelectedNode(id),
                      })}
                    />
                  </VStack>
                )}
                {dockId === "filters" && (
                  <VStack alignItems="stretch" spacing={3}>
                    <VStack alignItems="flex-start" as="section" spacing={1}>
                      <Heading as="h3" size="xs" color="gray.600">
                        Manually excluded ({excludedNodes.length})
                      </Heading>
                      <NodeList
                        nodes={excludedNodes}
                        kindMap={kindMap}
                        mapProps={(id) => ({
                          onCancel: () => toggleExcludeNode(id),
                        })}
                      />
                    </VStack>
                    <VStack alignItems="flex-start" as="section" spacing={1}>
                      <Heading as="h3" size="xs" color="gray.600">
                        Exclude with regex ({excludedNodesFromInput.length})
                      </Heading>
                      {excludeNodesFilterInputView}
                      <NodeList nodes={excludedNodesFromInput} />
                    </VStack>
                  </VStack>
                )}
                {dockId === "lookup" && (
                  <VStack alignItems="stretch" spacing={2}>
                    {inViewView}
                    <NodesFilter
                      nodes={inView ? renderedNodes : allNodes}
                      mapProps={(id) => ({
                        onExclude: () => toggleExcludeNode(id),
                        onSelect: () => setSelectedNode(id),
                      })}
                    />
                  </VStack>
                )}
                {dockId === "cycles" && (
                  <VStack alignItems="stretch" spacing={2}>
                    <Text fontSize="sm" color="gray.600">
                      {graphData.cycles.length} cycle{graphData.cycles.length === 1 ? "" : "s"} detected.
                    </Text>
                    {graphData.cycles.length > 0 ? (
                      <ListOfNodeList
                        containerProps={{ maxHeight: "calc(100vh - 220px)" }}
                        lists={graphData.cycles}
                        getProps={() => ({
                          mapProps: (id) => ({ onSelect: () => setSelectedNode(id) }),
                        })}
                      />
                    ) : (
                      <Text fontSize="sm" color="gray.400">
                        No cycles in the current filter.
                      </Text>
                    )}
                  </VStack>
                )}
                {dockId === "settings" && (
                  <VStack alignItems="stretch" spacing={4}>
                    <VStack alignItems="stretch" spacing={1}>
                      <Heading as="h3" size="xs" color="gray.600">General</Heading>
                      <SettingsOfOpenInVSCode />
                      <ExportButton data={entries} />
                    </VStack>
                    {vizMode !== "table" && (
                      <VStack alignItems="stretch" spacing={1}>
                        <Heading as="h3" size="xs" color="gray.600">Graph</Heading>
                        {graphModeView}
                        {colorByView}
                        {edgeStyleView}
                        {fontSizeView}
                        {separateAsyncImportsView}
                      </VStack>
                    )}
                  </VStack>
                )}
              </Box>
            </>
          )}
        </Box>
        <DockRail docks={dockDefs} activeId={dockId} onChange={setDockId} />
      </HStack>
      <InvestigatePanel
        isOpen={investigateTarget !== null}
        onClose={() => setInvestigateTarget(null)}
        file={investigateTarget?.file ?? null}
        initialSymbol={investigateTarget?.symbol ?? null}
        fs={investigatorFs}
        knownFiles={knownFiles}
        dependencyMap={data.dependencyMap}
        onHighlightedFilesChange={setHighlightedFiles}
        onFocusFile={(file) => setSelectedNode(file)}
        onNavigate={(file, symbol) => setInvestigateTarget({ file, symbol })}
      />
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />
    </HStack>
  );
}

function ContextMenuItem({
  children,
  onClick,
  isDisabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isDisabled?: boolean;
  title?: string;
}) {
  return (
    <Box
      as="button"
      display="block"
      w="100%"
      textAlign="left"
      px={3}
      py={1.5}
      fontSize="sm"
      color={isDisabled ? "gray.400" : undefined}
      cursor={isDisabled ? "not-allowed" : undefined}
      _hover={isDisabled ? undefined : { bg: "gray.100" }}
      title={title}
      onClick={isDisabled ? undefined : onClick}
    >
      {children}
    </Box>
  );
}
