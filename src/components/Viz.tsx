import { Accordion, Box, Button, Divider, HStack, Heading, ModalBody, Select, Text, VStack } from "@chakra-ui/react";
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
}: {
  entries: DependencyEntry[];
  setData: (entries: DependencyEntry[]) => void;
  onBack?: () => void;
  onRescan?: () => void;
}) {
  const data = React.useMemo(() => prepareGraphData(entries), [entries]);
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
  const [graphModeView, graphMode] = useSelectView<GraphMode>(
    {
      label: "Graph Mode",
      defaultValue: "dag",
    },
    [
      { value: "dag", label: "DAG (Directed Acyclic Graph, all nodes, no cycle)" },
      { value: "natural", label: "Natural (all nodes, allow cycles)" },
      { value: "cycles-only", label: `Cycles Only (only nodes on cycles)` },
    ]
  );

  const [colorByView, colorBy] = useSelectView<ColorByMode>(
    {
      label: "Color nodes by",
      defaultValue: "color-by-module",
    },
    [
      { value: "color-by-module", label: "Module" },
      { value: "color-by-depth", label: "File depth" },
      { value: "color-by-heat-both", label: "Connections" },
      { value: "color-by-heat-target", label: "Connections (dependency)" },
      { value: "color-by-heat-source", label: "Connections (dependant)" },
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
  const [fixNodeOnDragEndView, fixNodeOnDragEnd] = useCheckboxView({
    label: "Fix node on drag end",
    defaultValue: true,
  });
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

  const graphData = React.useMemo(
    () =>
      filterGraphData(data, {
        roots: restrictedRoots,
        leave: restrictedLeaves,
        excludes: allExcludedNodes,
        graphMode,
        separateAsyncImports,
      }),
    [data, restrictedRoots, restrictedLeaves, graphMode, allExcludedNodes, separateAsyncImports]
  );

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
  }), [closeContextMenu]);

  const [ref, render, rebuildLayout] = useGraph<HTMLDivElement>(
    {
      data,
      fixFontSize,
      fontSize,
      fixNodeOnDragEnd,
      width: vizContainerSize?.width || 0,
      height: vizContainerSize?.height || 0,
      enableDagMode: graphMode === "dag",
      colorBy,
      edgeStyle,
      cycleLinks,
      selectedNodeIds: selectedNodes.size > 0 ? selectedNodes : undefined,
      callbacks: graphCallbacks,
    }
  );

  const [layoutStale, setLayoutStale] = React.useState(false);
  const initialRenderRef = React.useRef(true);
  React.useEffect(() => {
    render?.(graphData);
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
    } else if (graphMode === "dag") {
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

  // The in-views
  const [inViewView, inView, setInView] = useSwitchView({
    label: "Hide nodes not rendered in viz",
    defaultValue: true,
  });
  const renderedNodes = React.useMemo(() => graphData?.nodes.map((node) => node.id), [graphData.nodes]);
  const links = graphData.links;
  const leavesInView = React.useMemo(
    () =>
      renderedNodes.filter(
        (id) => links.every(({ source }) => source !== id) && !links.every(({ target }) => target !== id)
      ),
    [renderedNodes, links]
  );
  const rootsInView = React.useMemo(
    () =>
      renderedNodes.filter(
        (id) => links.every(({ target }) => target !== id) && !links.every(({ source }) => source !== id)
      ),
    [renderedNodes, links]
  );

  const renderedEntries = React.useMemo(
    () =>
      entries
        .filter(([entry]) => renderedNodes.includes(entry))
        .map(([entry, dependencies]) => [
          entry,
          dependencies.filter(([dependency]) => renderedNodes.includes(dependency)),
        ]) satisfies DependencyEntry[],
    [entries, renderedNodes]
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
        <Box ref={vizContainerRef} flex={1} overflowY="auto" position="relative">
          <div ref={ref} style={{ display: vizMode === "table" ? "none" : undefined }} />
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
          <div style={{ display: vizMode === "graph" ? "none" : undefined }}>
            <EntriesTable entries={renderedEntries} onClickSelect={setSelectedNode} />
          </div>
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
                  {data.dependencyMap.get(contextMenu.nodeId)?.size ? (
                    <ContextMenuItem onClick={() => {
                      data.dependencyMap.get(contextMenu.nodeId!)?.forEach((dep) => {
                        if (!allExcludedNodes.has(dep)) toggleExcludeNode(dep);
                      });
                      closeContextMenu();
                    }}>
                      Exclude dependencies ({data.dependencyMap.get(contextMenu.nodeId)?.size})
                    </ContextMenuItem>
                  ) : null}
                  {data.dependantMap.get(contextMenu.nodeId)?.size ? (
                    <ContextMenuItem onClick={() => {
                      data.dependantMap.get(contextMenu.nodeId!)?.forEach((dep) => {
                        if (!allExcludedNodes.has(dep)) toggleExcludeNode(dep);
                      });
                      closeContextMenu();
                    }}>
                      Exclude dependants ({data.dependantMap.get(contextMenu.nodeId)?.size})
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
                <div>{fixNodeOnDragEndView}</div>
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
                  mapProps={(id) => ({
                    onSelect: () => setSelectedNode(id),
                    onExclude: () => toggleExcludeNode(id),
                  })}
                />
              </VStack>
            ) : selectedNode ? (
              <VStack alignItems="flex-start">
                <Heading as="h3" size="sm">
                  Recently selected nodes
                </Heading>
                <Select
                  value=""
                  placeholder="Choosing a node will switch selection"
                  onChange={(e) => setSelectedNode(e.target.value)}
                >
                  {/* slice 1 to exclude current selection */}
                  {nodeSelectionHistory.slice(1).map((node) => (
                    <option key={node} value={node}>
                      {node}
                    </option>
                  ))}
                </Select>

                <Heading as="h3" size="sm">
                  Path
                </Heading>
                <MonoText wordBreak="break-word">{selectedNode}</MonoText>
                <div>
                  <OpenInVSCode layout="text" path={selectedNode} />
                </div>
                <FormSwitch
                  label="Exclude from viz"
                  value={allExcludedNodes.has(selectedNode)}
                  onChange={() => toggleExcludeNode(selectedNode)}
                />

                <Heading as="h3" size="sm">
                  Dependencies
                </Heading>
                <NodeList
                  nodes={carry(data.dependencyMap.get(selectedNode), (set) =>
                    set ? renderedNodes.filter((id) => set.has(id)) : []
                  )}
                  mapProps={(id) => ({ onSelect: () => setSelectedNode(id) })}
                />
                <Heading as="h3" size="sm">
                  Dependents
                </Heading>
                <NodeList
                  nodes={carry(data.dependantMap.get(selectedNode), (set) =>
                    set ? renderedNodes.filter((id) => set.has(id)) : []
                  )}
                  mapProps={(id) => ({ onSelect: () => setSelectedNode(id) })}
                />
                <FindPathToNode
                  nodes={renderedNodes}
                  data={data}
                  selectedNode={selectedNode}
                  setSelectedNode={setSelectedNode}
                  nodeSelectionHistory={nodeSelectionHistory}
                />
              </VStack>
            ) : (
              <Text color="gray.500">No selection yet</Text>
            )}
          </CollapsibleSection>
          <CollapsibleSection label={`Showing dependencies of ...`}>
            <VStack alignItems="flex-start">
              <Text>These nodes are source files, which have no dependents, or they are in dependency cycles.</Text>
              {restrictRootInputView}
              <FormSwitch
                label="Hide nodes not rendered as root"
                inputProps={{
                  isDisabled: restrictRootsRegExp === null,
                }}
                value={restrictRootsRegExp === null || inView}
                onChange={() => setInView(!inView)}
              />
              <NodeList
                nodes={restrictRootsRegExp === null || inView ? rootsInView : [...restrictedRoots]}
                mapProps={(id) => ({
                  onExclude: () => toggleExcludeNode(id),
                  onSelect: () => setSelectedNode(id),
                })}
              />
            </VStack>
          </CollapsibleSection>
          <CollapsibleSection label={`Showing dependents of ...`}>
            <VStack alignItems="flex-start">
              <Text>
                These nodes have no dependencies, some of them are 3rd party dependencies, or they are in dependency
                cycles.
              </Text>
              {restrictLeavesInputView}
              <FormSwitch
                label="Hide nodes not rendered as leave"
                inputProps={{
                  isDisabled: restrictLeavesRegExp === null,
                }}
                value={restrictLeavesRegExp === null || inView}
                onChange={() => setInView(!inView)}
              />
              <NodeList
                nodes={restrictLeavesRegExp === null || inView ? leavesInView : [...restrictedLeaves]}
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
    </HStack>
  );
}

function ContextMenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Box
      as="button"
      display="block"
      w="100%"
      textAlign="left"
      px={3}
      py={1.5}
      fontSize="sm"
      _hover={{ bg: "gray.100" }}
      onClick={onClick}
    >
      {children}
    </Box>
  );
}
