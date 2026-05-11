import { Accordion, Box, Button, Divider, HStack, Heading, IconButton, ModalBody, Select, Text, VStack } from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
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
import { CollapsibleSection } from "./CollapsibleSection";
import { ExportButton } from "./ExportButton";
import { FindPathToNode } from "./FindPathToNode";
import { FormSwitch } from "./FormSwitch";
import { HorizontalResizeHandler } from "./HorizontalResizeHandler";
import { InvestigatePanel } from "./UsageInvestigator/InvestigatePanel";
import { InvestigatorFs } from "../lib/usage-investigator";
import { ListOfNodeList } from "./ListOfNodeList";
import { ModalButton } from "./ModalButton";
import { MonoText } from "./MonoText";
import { NodeList } from "./NodeList";
import { NodesFilter } from "./NodesFilter";
import { OpenInVSCode, SettingsOfOpenInVSCode } from "./OpenInVSCode";
import { EntriesTable } from "./Scan/EntriesTable";
import { ArrowBackIcon, RepeatIcon } from "@chakra-ui/icons";

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
  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView({
    helperText: "Nodes match this regex will be excluded",
  });
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? allNodes.filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [excludeNodesFilterRegExp, allNodes]
  );
  const [excludedNodes, toggleExcludeNode] = useSet<string>();
  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedNodes]),
    [excludedNodesFromInput, excludedNodes]
  );
  const nonExcludedNodes = React.useMemo(
    () => allNodes.filter((id) => !allExcludedNodes.has(id)),
    [allNodes, allExcludedNodes]
  );

  // Restrictions
  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInputView({
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
  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInputView({
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

  const [vizModeView, vizMode] = useRadioGroupView(
    "Viz Mode",
    [
      { value: "table", label: "Table" },
      { value: "graph", label: "Graph" },
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
    onNodeHover: (id) => setHoveredNodeId(id),
    onZoomChange: (k) => setZoomScale(k),
  }), [closeContextMenu]);

  const [ref, render, rebuildLayout] = useGraph<HTMLDivElement>(
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

  return (
    <HStack display="inline-flex" alignItems="stretch" spacing={0} maxHeight="100%" height="100vh">
      <VStack alignItems="stretch" height="100vh" width={width} spacing={0}>
        <HStack justifyContent="space-between" padding={2}>
          <HStack>
            <Button onClick={onBack} aria-label={"Back"}>
              <ArrowBackIcon />
            </Button>
            <Button onClick={onRescan} aria-label={"Re-scan"}>
              <RepeatIcon />
            </Button>
          </HStack>
          {vizModeView}
        </HStack>
        <Divider height="auto" />
        <Box
          ref={vizContainerRef}
          flex={1}
          overflow={vizMode === "table" ? "hidden" : "auto"}
          position="relative"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          <div ref={ref} style={{ display: vizMode === "table" ? "none" : undefined }} />
          {showTooltip && (
            <Box
              position="absolute"
              left={mousePos.x + 14}
              top={mousePos.y - 8}
              pointerEvents="none"
              zIndex={20}
              bg="gray.700"
              color="white"
              borderRadius="md"
              px={2}
              py={1}
              fontSize="xs"
              maxWidth="320px"
              wordBreak="break-all"
              boxShadow="md"
            >
              {hoveredNodeId}
            </Box>
          )}
          {layoutStale && vizMode === "graph" && (
            <Button
              position="absolute"
              top={2}
              right={2}
              zIndex={5}
              size="sm"
              colorScheme="blue"
              leftIcon={<RepeatIcon />}
              onClick={handleRebuildLayout}
              aria-label="Rebuild DAG layout"
            >
              Rebuild layout
            </Button>
          )}
          {vizMode === "table" && (
            <EntriesTable entries={renderedEntries} onClickSelect={setSelectedNode} />
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
      </VStack>
      <HorizontalResizeHandler onPointerDown={onPointerDown} />
      <VStack alignItems="stretch" height="100vh" flex={1} minW={0} overflow="auto">
        <Accordion defaultIndex={[0]} minW={0} allowToggle>
          <CollapsibleSection label={`General Settings`}>
            <VStack alignItems="stretch">
              <div>
                <SettingsOfOpenInVSCode />
              </div>
              <div>
                <ExportButton data={entries} />
              </div>
            </VStack>
          </CollapsibleSection>
          {vizMode === "graph" && (
            <CollapsibleSection label={`Graph Settings`}>
              <VStack alignItems="stretch">
                <div>{graphModeView}</div>
                {graphMode === "cycles-only" && (
                  <div>
                    <ModalButton
                      title={"Cycles"}
                      renderTrigger={({ onOpen }) => <Button onClick={onOpen}>Review cycles list</Button>}
                    >
                      {() => (
                        <ModalBody>
                          <Text>There are {graphData.cycles.length} in total.</Text>
                          <ListOfNodeList
                            containerProps={{ maxHeight: 600 }}
                            lists={graphData.cycles}
                            getProps={() => ({
                              mapProps: (id) => ({ onSelect: () => setSelectedNode(id) }),
                            })}
                          />
                        </ModalBody>
                      )}
                    </ModalButton>
                  </div>
                )}
                <div>{colorByView}</div>
                <div>{edgeStyleView}</div>
                <div>{fontSizeView}</div>
                <div>{separateAsyncImportsView}</div>
              </VStack>
            </CollapsibleSection>
          )}
          <CollapsibleSection label={`Selected Node${selectedNodes.size > 1 ? `s (${selectedNodes.size})` : ""}`}>
            {selectedNodes.size > 1 ? (
              <VStack alignItems="flex-start">
                <Text fontSize="sm" color="gray.600">{selectedNodes.size} nodes selected (Ctrl/Cmd+click to toggle)</Text>
                <Button size="sm" onClick={() => setSelectedNodes(new Set())}>Clear selection</Button>
                <Button size="sm" colorScheme="red" variant="outline" onClick={() => {
                  selectedNodes.forEach((id) => {
                    if (!allExcludedNodes.has(id)) toggleExcludeNode(id);
                  });
                  setSelectedNodes(new Set());
                }}>
                  Exclude all selected
                </Button>
                <NodeList
                  nodes={[...selectedNodes]}
                  kindMap={kindMap}
                  mapProps={(id) => ({
                    onSelect: () => setSelectedNode(id),
                    onExclude: () => toggleExcludeNode(id),
                  })}
                />
              </VStack>
            ) : selectedNode ? (
              (() => {
                const displayedNode = nodeSelectionHistory[historyOffset] ?? selectedNode;
                return (
                <VStack alignItems="flex-start">
                  <HStack width="100%" justifyContent="space-between" alignItems="center">
                    <IconButton
                      aria-label="Previous node"
                      icon={<ChevronLeftIcon />}
                      size="xs"
                      variant="ghost"
                      isDisabled={historyOffset >= nodeSelectionHistory.length - 1}
                      onClick={() => setHistoryOffset((o) => o + 1)}
                    />
                    <Heading as="h3" size="sm" flex={1} textAlign="center">
                      Recently selected nodes
                    </Heading>
                    <IconButton
                      aria-label="Next node"
                      icon={<ChevronRightIcon />}
                      size="xs"
                      variant="ghost"
                      isDisabled={historyOffset <= 0}
                      onClick={() => setHistoryOffset((o) => o - 1)}
                    />
                  </HStack>
                  <Select
                    value={displayedNode}
                    onChange={(e) => {
                      const idx = nodeSelectionHistory.indexOf(e.target.value);
                      setHistoryOffset(idx >= 0 ? idx : 0);
                    }}
                    size="sm"
                  >
                    {nodeSelectionHistory.map((node) => (
                      <option key={node} value={node}>
                        {node}
                      </option>
                    ))}
                  </Select>

                  <Heading as="h3" size="sm">
                    Path
                  </Heading>
                  <MonoText wordBreak="break-word" fontSize="xs">{displayedNode}</MonoText>
                  <div>
                    <OpenInVSCode layout="text" path={displayedNode} size="xs" />
                  </div>

                  <Button
                    size="xs"
                    variant="outline"
                    isDisabled={!investigatorFs}
                    title={!investigatorFs ? "Source files are not available for this dataset" : undefined}
                    onClick={() => setInvestigateTarget({ file: displayedNode })}
                  >
                    Investigate exports…
                  </Button>

                  <Heading as="h3" size="sm">
                    Imports
                  </Heading>
                  <NodeList
                    nodes={carry(data.dependencyMap.get(displayedNode), (set) =>
                      set ? renderedNodes.filter((id) => set.has(id)) : []
                    )}
                    kindMap={kindMap}
                    mapProps={(id) => ({
                      onSelect: () => setSelectedNode(id),
                      onInvestigate: investigatorFs ? () => setInvestigateTarget({ file: id }) : undefined,
                    })}
                  />
                  <Heading as="h3" size="sm">
                    Imported by
                  </Heading>
                  <NodeList
                    nodes={carry(data.dependantMap.get(displayedNode), (set) =>
                      set ? renderedNodes.filter((id) => set.has(id)) : []
                    )}
                    kindMap={kindMap}
                    mapProps={(id) => ({
                      onSelect: () => setSelectedNode(id),
                      onInvestigate: investigatorFs ? () => setInvestigateTarget({ file: id }) : undefined,
                    })}
                  />
                  <FindPathToNode
                    nodes={renderedNodes}
                    data={data}
                    selectedNode={displayedNode}
                    setSelectedNode={setSelectedNode}
                    nodeSelectionHistory={nodeSelectionHistory}
                  />
                  <FormSwitch
                    label="Exclude from viz"
                    value={allExcludedNodes.has(displayedNode)}
                    onChange={() => toggleExcludeNode(displayedNode)}
                  />
                </VStack>
                );
              })()
            ) : (
              <Text color="gray.500">No selection yet</Text>
            )}
          </CollapsibleSection>
          <CollapsibleSection label={`Entry points`}>
            <VStack alignItems="flex-start">
              <Text>These files import others but are not imported by anything — they are entry points or roots of the graph.</Text>
              {restrictRootInputView}
              <FormSwitch
                label="Hide nodes not rendered as entry point"
                inputProps={{
                  isDisabled: restrictRootsRegExp === null,
                }}
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
          </CollapsibleSection>
          <CollapsibleSection label={`Leaf files`}>
            <VStack alignItems="flex-start">
              <Text>
                These files are imported by others but import nothing themselves — utilities, types, constants, or 3rd party packages.
              </Text>
              {restrictLeavesInputView}
              <FormSwitch
                label="Hide nodes not rendered as leaf"
                inputProps={{
                  isDisabled: restrictLeavesRegExp === null,
                }}
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
          </CollapsibleSection>
          <CollapsibleSection label={`Extra Filters`}>
            <VStack alignItems="stretch">
              <VStack alignItems="flex-start" as="section">
                <Heading as="h3" size="sm">
                  These nodes have been excluded
                </Heading>
                <NodeList
                  nodes={excludedNodes}
                  kindMap={kindMap}
                  mapProps={(id) => ({
                    onCancel: () => toggleExcludeNode(id),
                  })}
                />
              </VStack>
              <VStack alignItems="flex-start" as="section">
                <Heading as="h3" size="sm">
                  Exclude with regex
                </Heading>
                {excludeNodesFilterInputView}
                <NodeList nodes={excludedNodesFromInput} />
              </VStack>
            </VStack>
          </CollapsibleSection>
          <CollapsibleSection label={`Look up nodes`}>
            <VStack alignItems="stretch">
              {inViewView}
              <NodesFilter
                nodes={inView ? renderedNodes : allNodes}
                mapProps={(id) => ({
                  onExclude: () => toggleExcludeNode(id),
                  onSelect: () => setSelectedNode(id),
                })}
              />
            </VStack>
          </CollapsibleSection>
          <Box height={360} />
        </Accordion>
      </VStack>
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
