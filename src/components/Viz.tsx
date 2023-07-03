import { Accordion, Box, Heading, Select, Text, VStack } from "@chakra-ui/react";
import useResizeObserver from "@react-hook/resize-observer";
import * as React from "react";
import { useWindowSize } from "react-use";
import { useGraph } from "../hooks/useGraph";
import { useResizeHandler } from "../hooks/useResizeHandler";
import { useSet } from "../hooks/useSet";
import { useCheckboxView } from "../hooks/view/useCheckboxView";
import { useNumberInputView } from "../hooks/view/useInputView";
import { useRegExpInputView } from "../hooks/view/useRegExpInputView";
import { useSelectView } from "../hooks/view/useSelectView";
import { DependencyEntry } from "../services/serializers";
import { carry } from "../utils/general";
import { getData, prepareGraphData } from "../utils/getData";
import { DAGDirections } from "../utils/graphDecorators";
import { CollapsibleSection } from "./CollapsibleSection";
import { ExportButton } from "./ExportButton";
import { FindPathToNode } from "./FindPathToNode";
import { ListOfNodeList } from "./ListOfNodeList";
import { LocalPathContextProvider } from "./LocalPathContext";
import { MonoText } from "./MonoText";
import { NodeList } from "./NodeList";
import { NodesFilter } from "./NodesFilter";
import { OpenInVSCode, SettingsOfOpenInVSCode } from "./OpenInVSCode";
import { Switch } from "./Switch";

export function Viz({
  entries,
  setData,
  backButton,
}: {
  entries: DependencyEntry[];
  setData: (entries: DependencyEntry[]) => void;
  backButton?: React.ReactNode;
}) {
  // Use views
  const data = React.useMemo(() => prepareGraphData(entries), [entries]);
  const [renderAsTextView, renderAsText] = useCheckboxView("Render as Text", true);
  const [colorByView, colorBy] = useSelectView(
    "Color by",
    [
      { value: "depth", label: "File depth" },
      { value: "connection-both", label: "Connections" },
      { value: "connection-dependency", label: "Connections (dependency)" },
      { value: "connection-dependant", label: "Connections (dependant)" },
    ],
    "connection-both"
  );
  const [fixNodeOnDragEndView, fixNodeOnDragEnd] = useCheckboxView("Fix node on drag end", true);

  const [pruneCycleView, pruneCycle] = useCheckboxView("Prune Cycle", false);
  const [dagModeView, dagMode] = useSelectView<DAGDirections>(
    "DAG Mode",
    [
      { value: null, label: "Disable (render circular references)" },
      { value: "lr", label: "Left to Right" },
      { value: "rl", label: "Right to Left" },
      { value: "td", label: "Top to Bottom" },
      { value: "bu", label: "Bottom to Top" },
      { value: "radialout", label: "Radial Out" },
      { value: "radialin", label: "Radial In" },
    ],
    "lr",
    { isDisabled: pruneCycle }
  );
  const [dagPruneModeView, dagPruneMode] = useSelectView(
    "DAG Prune Mode",
    dagMode
      ? [
          { value: "less roots", label: "Less roots" },
          { value: "less leave", label: "Less leave" },
        ]
      : [],
    "less roots",
    { isDisabled: !dagMode || pruneCycle }
  );

  // Excludes
  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView("test", {
    helperText: "Nodes match this regex will be excluded",
  });
  const allNodes = React.useMemo(() => [...data.nodes.keys()].sort(), [data.nodes]);
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? allNodes.filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [excludeNodesFilterRegExp, allNodes]
  );
  const [excludedNodes, toggleExcludeNode] = useSet<string>();
  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedNodes]),
    [excludedNodesFromInput, excludedNodes]
  );

  // Restrictions
  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInputView("", {
    inputProps: { placeholder: "Filter nodes with RegExp" },
    helperText: "Only nodes match this regex will be regarded as roots.",
  });
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        allNodes.filter((id) => !allExcludedNodes.has(id) && (!restrictRootsRegExp || id.match(restrictRootsRegExp)))
      ),
    [allNodes, allExcludedNodes, restrictRootsRegExp]
  );
  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInputView("", {
    inputProps: { placeholder: "Filter nodes with RegExp" },
    helperText: "Only nodes match this regex will be regarded as leave.",
  });
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        allNodes.filter((id) => !allExcludedNodes.has(id) && (!restrictLeavesRegExp || id.match(restrictLeavesRegExp)))
      ),
    [allNodes, allExcludedNodes, restrictLeavesRegExp]
  );

  // Graph
  const [fixFontSizeView, fixFontSize] = useCheckboxView("Fix font size to canvas", true, {
    isDisabled: !renderAsText,
  });
  const [fixedFontSizeView, fixedFontSize] = useNumberInputView(4, {
    label: "Fixed Font Size",
    inputProps: {
      keepWithinRange: true,
      clampValueOnBlur: true,
      min: 1,
      isDisabled: !fixFontSize || !renderAsText,
    },
  });
  const [[width, height], setSize] = React.useState(() => [window.innerWidth / 2, window.innerHeight]);
  const windowSize = useWindowSize(width, height);
  const vizWidthLimit = React.useMemo(() => {
    const widthForOthers = 300;
    return {
      maxWidth: windowSize.width - widthForOthers,
      minWidth: 200,
    };
  }, [windowSize]);
  const actualWidth = React.useMemo(() => {
    if (width < vizWidthLimit.minWidth) return vizWidthLimit.minWidth;
    if (width > vizWidthLimit.maxWidth) return vizWidthLimit.maxWidth;
    return width;
  }, [vizWidthLimit, width]);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  useResizeObserver(
    containerRef,
    React.useCallback((entry) => {
      setSize(([width, height]) => [width, entry.contentRect.height]);
    }, [])
  );

  const { onPointerDown } = useResizeHandler([width, height], setSize);

  const [ref, render, selectedNode, setSelectedNode] = useGraph({
    data,
    dagMode: pruneCycle ? null : dagMode,
    fixNodeOnDragEnd,
    renderAsText,
    width: actualWidth,
    height,
    fixedFontSize: (fixFontSize && fixedFontSize) || undefined,
    colorBy,
  });

  const getDataOptions = React.useMemo(
    () => ({
      roots: restrictedRoots,
      leave: restrictedLeaves,
      preventCycle: pruneCycle ? false : dagMode !== null,
      dagPruneMode,
      excludes: allExcludedNodes,
    }),
    [restrictedRoots, restrictedLeaves, pruneCycle, dagMode, dagPruneMode, allExcludedNodes]
  );

  const graphData = React.useMemo(() => getData(data, getDataOptions), [data, getDataOptions]);
  const { cycles, nodes, links } = React.useMemo(
    () =>
      pruneCycle
        ? carry(
            graphData.nodes.filter((node) => graphData.cycles.some((cycle) => cycle.includes(node.id))),
            (nodes) => ({
              cycles: graphData.cycles,
              nodes,
              links: graphData.links.filter(
                ({ source, target }) =>
                  nodes.some((node) => node.id === source) && nodes.some((node) => node.id === target)
              ),
            })
          )
        : graphData,
    [graphData, pruneCycle]
  );

  const renderData = React.useMemo(
    () => ({ nodes: nodes.map((_) => ({ ..._ })), links: links.map((_) => ({ ..._ })) }),
    [nodes, links]
  );
  React.useEffect(() => {
    render?.(renderData);
  }, [render, renderData]);

  const [nodeSelectionHistory, setNodeSelectionHistory] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (selectedNode) {
      setNodeSelectionHistory((history) => [selectedNode, ...history.filter((node) => node !== selectedNode)]);
    }
  }, [selectedNode]);

  // The in-views
  const [inView, setInView] = React.useState(true);
  const renderedNodes = React.useMemo(() => renderData?.nodes.map((node) => node.id as string), [renderData.nodes]);
  const leavesInView = React.useMemo(
    () => renderedNodes.filter((id) => renderData.links.every(({ target }) => target !== id)),
    [renderedNodes, renderData.links]
  );
  const rootsInView = React.useMemo(
    () => renderedNodes.filter((id) => renderData.links.every(({ source }) => source !== id)),
    [renderedNodes, renderData.links]
  );

  return (
    <LocalPathContextProvider>
      <Box display="flex" ref={containerRef} overflow="auto">
        <div>
          {backButton}
          <div ref={ref} />
        </div>
        <Box
          display="inline-block"
          width="2px"
          flexShrink={0}
          background={"ButtonFace"}
          _hover={{
            background: "ButtonHighlight",
            outline: "1px solid ButtonHighlight",
          }}
          _active={{
            background: "ActiveBorder",
            outline: "1px solid ActiveBorder",
          }}
          cursor="ew-resize"
          onPointerDown={onPointerDown}
        />
        <VStack alignItems="stretch" flex={1} maxHeight="100%" minW={0} overflow="auto">
          <Accordion defaultIndex={[0]} minW={0} allowToggle>
            <CollapsibleSection label={`General Settings`}>
              <VStack alignItems="stretch">
                <div>{dagModeView}</div>
                <div>{dagPruneModeView}</div>
                <div>{pruneCycleView}</div>
                <div>{colorByView}</div>
                <div>{fixNodeOnDragEndView}</div>
                <div>{renderAsTextView}</div>
                <div>{fixFontSizeView}</div>
                <div>{fixedFontSizeView}</div>
                <div>
                  <SettingsOfOpenInVSCode />
                </div>
                <div>
                  <ExportButton data={entries} />
                </div>
              </VStack>
            </CollapsibleSection>
            <CollapsibleSection label={`Selected Node`}>
              {selectedNode ? (
                <VStack alignItems="flex-start">
                  <Heading as="h3" size="sm">
                    Path
                  </Heading>
                  <MonoText wordBreak="break-word">{selectedNode}</MonoText>
                  <div>
                    <OpenInVSCode layout="text" path={selectedNode} />
                  </div>
                  <Switch
                    isChecked={allExcludedNodes.has(selectedNode)}
                    onChange={() => toggleExcludeNode(selectedNode)}
                  >
                    Exclude from viz
                  </Switch>

                  <Heading as="h3" size="sm">
                    Dependencies
                  </Heading>
                  <NodeList
                    nodes={carry(data.dependencyMap.get(selectedNode), (set) =>
                      set ? renderedNodes.filter((id) => set.has(id)) : renderedNodes
                    )}
                    mapProps={(id) => ({ onSelect: () => setSelectedNode(id) })}
                  />
                  <Heading as="h3" size="sm">
                    Dependents
                  </Heading>
                  <NodeList
                    nodes={carry(data.dependantMap.get(selectedNode), (set) =>
                      set ? renderedNodes.filter((id) => set.has(id)) : renderedNodes
                    )}
                    mapProps={(id) => ({ onSelect: () => setSelectedNode(id) })}
                  />
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
                  {/* <Button onClick={() => excludeNodeDependents(selectedNode)}>
                      Toggle exclude its dependents
                    </Button>
                    <Button onClick={() => excludeNodeDependencies(selectedNode)}>
                    Toggle exclude its dependencies
                    </Button>
                    <Button disabled>TODO: Add to root nodes</Button>
                  */}

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
            <CollapsibleSection label={`Root Nodes`}>
              <VStack alignItems="flex-start">
                <Text>
                  These nodes have no dependencies, some of them are 3rd party dependencies, or they are in dependency
                  cycles.
                </Text>
                {restrictRootInputView}
                <Switch
                  isDisabled={restrictRootsRegExp === null}
                  isChecked={restrictRootsRegExp === null || inView}
                  onChange={() => setInView(!inView)}
                >
                  Hide nodes not rendered as root
                </Switch>
                <NodeList
                  nodes={restrictRootsRegExp === null || inView ? rootsInView : [...restrictedRoots]}
                  mapProps={(id) => ({
                    onExclude: () => toggleExcludeNode(id),
                    onSelect: () => setSelectedNode(id),
                  })}
                />
              </VStack>
            </CollapsibleSection>
            <CollapsibleSection label={`Leaf Nodes`}>
              <VStack alignItems="flex-start">
                <Text>These nodes are source files, which have no dependents, or they are in dependency cycles.</Text>
                {restrictLeavesInputView}
                <Switch
                  isDisabled={restrictLeavesRegExp === null}
                  isChecked={restrictLeavesRegExp === null || inView}
                  onChange={() => setInView(!inView)}
                >
                  Hide nodes not rendered as leave
                </Switch>
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
                <Switch isChecked={inView} onChange={() => setInView(!inView)}>
                  Hide nodes not rendered in viz
                </Switch>
                <NodesFilter
                  nodes={inView ? renderedNodes : allNodes}
                  mapProps={(id) => ({
                    onExclude: () => toggleExcludeNode(id),
                    onSelect: () => setSelectedNode(id),
                  })}
                />
              </VStack>
            </CollapsibleSection>
            <CollapsibleSection label={`Cycles`}>
              <VStack alignItems="flex-start">
                <Text>There are {cycles.length} cycles</Text>
                <ListOfNodeList
                  lists={cycles}
                  getProps={() => ({
                    mapProps: (id) => ({ onSelect: () => setSelectedNode(id) }),
                  })}
                />
              </VStack>
            </CollapsibleSection>
            <Box height={360} />
          </Accordion>
        </VStack>
      </Box>
    </LocalPathContextProvider>
  );
}
