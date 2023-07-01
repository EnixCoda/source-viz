import { Accordion, Box, FormControl, FormLabel, Heading, Select, Switch, VStack } from "@chakra-ui/react";
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
import { getData, prepareGraphData } from "../utils/getData";
import { DAGDirections } from "../utils/graphDecorators";
import { CollapsibleSection } from "./CollapsibleSection";
import { FindPathToNode } from "./FindPathToNode";
import { ListOfNodeList } from "./ListOfNodeList";
import { LocalPathContextProvider } from "./LocalPathContext";
import { MonoText } from "./MonoText";
import { NodeList } from "./NodeList";
import { NodesFilter } from "./NodesFilter";
import { OpenInVSCode, SettingsOfOpenInVSCode } from "./OpenInVSCode";

export function Viz({
  entries,
  setData,
}: {
  entries: DependencyEntry[];
  setData: (entries: DependencyEntry[]) => void;
}) {
  // Use views
  const data = React.useMemo(() => prepareGraphData(entries), [entries]);
  const [renderAsTextView, renderAsText] = useCheckboxView("Render as Text", true);
  const [colorByView, colorBy] = useSelectView(
    "Color by: ",
    [
      { value: "depth", label: "File depth" },
      { value: "connection-both", label: "Connections" },
      { value: "connection-dependency", label: "Connections (dependency)" },
      { value: "connection-dependant", label: "Connections (dependant)" },
    ],
    "connection-both"
  );
  const [fixNodeOnDragEndView, fixNodeOnDragEnd] = useCheckboxView("Fix node on drag end", true);
  const [dagPruneModeView, dagPruneMode] = useSelectView(
    "DAG Prune Mode: ",
    [
      { value: "less roots", label: "Less roots" },
      { value: "less leaves", label: "Less leaves" },
    ],
    "less roots"
  );
  const [dagModeView, dagMode] = useSelectView<DAGDirections>(
    "DAG Mode: ",
    [
      { value: null, label: "Disable (render circular references)" },
      { value: "lr", label: "Left to Right" },
      { value: "rl", label: "Right to Left" },
      { value: "td", label: "Top to Bottom" },
      { value: "bu", label: "Bottom to Top" },
      { value: "radialout", label: "Radial Out" },
      { value: "radialin", label: "Radial In" },
    ],
    "lr"
  );

  // Excludes
  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView("test");
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? [...data.nodes.keys()].filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [excludeNodesFilterRegExp, data.nodes]
  );
  const [excludedDependentsNodes, toggleExcludeNodeDependents] = useSet<string>();
  const [excludedDependenciesNodes, toggleExcludeNodeDependencies] = useSet<string>();
  const toggleExcludeNode = React.useCallback(
    (id: string) => {
      toggleExcludeNodeDependencies(id);
      toggleExcludeNodeDependents(id);
    },
    [toggleExcludeNodeDependencies, toggleExcludeNodeDependents]
  );
  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedDependentsNodes, ...excludedDependenciesNodes]),
    [excludedNodesFromInput, excludedDependentsNodes, excludedDependenciesNodes]
  );

  // Restrictions
  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInputView();
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        [...data.dependencies.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictRootsRegExp || id.match(restrictRootsRegExp))
        )
      ),
    [data.dependencies, restrictRootsRegExp, allExcludedNodes]
  );
  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInputView();
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        [...data.nodes.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictLeavesRegExp || id.match(restrictLeavesRegExp))
        )
      ),
    [data.nodes, restrictLeavesRegExp, allExcludedNodes]
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
    dagMode,
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
      leaves: restrictedLeaves,
      preventCycle: dagMode !== null,
      dagPruneMode,
      excludeUp: allExcludedNodes,
      excludeDown: allExcludedNodes,
    }),
    [restrictedRoots, restrictedLeaves, dagMode, dagPruneMode, allExcludedNodes]
  );

  const { cycles, nodes, links } = React.useMemo(() => getData(data, getDataOptions), [data, getDataOptions]);
  const renderData = React.useMemo(() => ({ nodes, links }), [nodes, links]);
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
  const renderedNodeIds = React.useMemo(() => renderData?.nodes.map((node) => node.id as string), [renderData.nodes]);
  const leavesInView = React.useMemo(
    () => renderedNodeIds.filter((id) => renderData.links.every(({ target }) => target !== id)),
    [renderedNodeIds, renderData.links]
  );
  const rootsInView = React.useMemo(
    () => renderedNodeIds.filter((id) => renderData.links.every(({ source }) => source !== id)),
    [renderedNodeIds, renderData.links]
  );

  return (
    <LocalPathContextProvider>
      <Box display="flex" ref={containerRef} overflow="auto">
        <div ref={ref} />
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
        <VStack alignItems="stretch" flex={1} gap={2} maxHeight="100%" minW={0} overflow="auto">
          <Accordion allowMultiple defaultIndex={[0]} minW={0}>
            <CollapsibleSection label={`General Settings`}>
              <Box display="flex" flexDirection="column" gap={2}>
                <div>{dagPruneModeView}</div>
                <div>{dagModeView}</div>
                <div>{colorByView}</div>
                <div>{fixNodeOnDragEndView}</div>
                <div>{renderAsTextView}</div>
                <div>{fixFontSizeView}</div>
                <div>{fixedFontSizeView}</div>
                <div>
                  <SettingsOfOpenInVSCode />
                </div>
              </Box>
            </CollapsibleSection>
            <CollapsibleSection label={`Selected Node`}>
              {selectedNode ? (
                <Box display="flex" flexDirection="column" gap={2}>
                  <Heading as="h3" size="sm">
                    Path
                  </Heading>
                  <MonoText wordBreak="break-word">{selectedNode}</MonoText>
                  <div>
                    <OpenInVSCode layout="text" path={selectedNode} />
                  </div>
                  <FormControl display="flex" alignItems="center" columnGap={1}>
                    <Switch
                      isChecked={
                        excludedDependentsNodes.some((id) => id === selectedNode) ||
                        excludedDependenciesNodes.some((id) => id === selectedNode)
                      }
                      onChange={() => toggleExcludeNode(selectedNode)}
                    />
                    <FormLabel mb={0}>Exclude from viz</FormLabel>
                  </FormControl>
                  {/* excludedDependents: excludedDependentsNodes.some(
                      (id) => id === selectedNode
                      ),
                    excludedDependencies: excludedDependenciesNodes.some(
                      (id) => id === selectedNode
                    ), */}
                  <Heading as="h3" size="sm">
                    Dependencies
                  </Heading>
                  <NodeList
                    nodes={[...(data.dependencyMap.get(selectedNode) || [])].filter((id) =>
                      renderedNodeIds.includes(id)
                    )}
                    mapProps={(id) => ({
                      onSelect: () => setSelectedNode(id),
                    })}
                  />
                  <Heading as="h3" size="sm">
                    Dependents
                  </Heading>
                  <NodeList
                    nodes={[...(data.dependantMap.get(selectedNode) || [])].filter((id) =>
                      renderedNodeIds.includes(id)
                    )}
                    mapProps={(id) => ({
                      onSelect: () => setSelectedNode(id),
                    })}
                  />
                  <Heading as="h3" size="sm">
                    Recent selected nodes
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
                    nodes={renderedNodeIds}
                    data={data}
                    selectedNode={selectedNode}
                    setSelectedNode={setSelectedNode}
                  />
                </Box>
              ) : (
                "No selection yet"
              )}
            </CollapsibleSection>
            <CollapsibleSection label={`Root Nodes`}>
              {restrictRootInputView}
              <NodeList
                nodes={rootsInView}
                mapProps={(id) => ({
                  onExclude: () => toggleExcludeNodeDependents(id),
                  onSelect: () => setSelectedNode(id),
                })}
              />
            </CollapsibleSection>
            <CollapsibleSection label={`Leaf Nodes`}>
              {restrictLeavesInputView}
              <NodeList
                nodes={leavesInView}
                mapProps={(id) => ({
                  onExclude: () => toggleExcludeNodeDependencies(id),
                  onSelect: () => setSelectedNode(id),
                })}
              />
            </CollapsibleSection>
            <CollapsibleSection label={`Extra Filters`}>
              <VStack alignItems="stretch" gap={1}>
                <VStack alignItems="flex-start" as="section" spacing={0}>
                  <Heading as="h3" size="sm">
                    Exclude Dependents of Them
                  </Heading>
                  <NodeList
                    nodes={excludedDependentsNodes}
                    mapProps={(id) => ({
                      onCancel: () => toggleExcludeNodeDependents(id),
                    })}
                  />
                </VStack>
                <VStack alignItems="flex-start" as="section" spacing={0}>
                  <Heading as="h3" size="sm">
                    Exclude Dependencies of Them
                  </Heading>
                  <NodeList
                    nodes={excludedDependenciesNodes}
                    mapProps={(id) => ({
                      onCancel: () => toggleExcludeNodeDependencies(id),
                    })}
                  />
                </VStack>
                <VStack alignItems="flex-start" as="section" spacing={0}>
                  <Heading as="h3" size="sm">
                    Exclude with regex
                  </Heading>
                  {excludeNodesFilterInputView}
                  <NodeList nodes={excludedNodesFromInput} />
                </VStack>
              </VStack>
            </CollapsibleSection>
            <CollapsibleSection label={`Look up nodes in view (${renderData?.nodes.length || 0} in total)`}>
              <NodesFilter
                nodes={renderedNodeIds}
                mapProps={(id) => ({
                  onExclude: () => toggleExcludeNode(id),
                  onSelect: () => setSelectedNode(id),
                })}
              />
            </CollapsibleSection>
            <CollapsibleSection label={`Cycles (${cycles.length} in total)`}>
              <ListOfNodeList
                lists={cycles}
                getProps={() => ({
                  mapProps: (id) => ({
                    onSelect: () => setSelectedNode(id),
                  }),
                })}
              />
            </CollapsibleSection>
            <Box height={360} />
          </Accordion>
        </VStack>
      </Box>
    </LocalPathContextProvider>
  );
}
