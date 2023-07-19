import { Accordion, Box, Button, Divider, HStack, Heading, ModalBody, Select, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { useWindowSize } from "react-use";
import { useGraph } from "../hooks/graph/useGraph";
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

export function Viz({
  entries,
  setData,
  backButton,
}: {
  entries: DependencyEntry[];
  setData: (entries: DependencyEntry[]) => void;
  backButton?: React.ReactNode;
}) {
  const data = React.useMemo(() => prepareGraphData(entries), [entries]);
  const allNodes = React.useMemo(() => [...data.nodes.keys()].sort(), [data.nodes]);

  // Excludes
  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView({
    helperText: "Nodes match this regex will be excluded",
  });
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? allNodes.filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [excludeNodesFilterRegExp, allNodes],
  );
  const [excludedNodes, toggleExcludeNode] = useSet<string>();
  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedNodes]),
    [excludedNodesFromInput, excludedNodes],
  );
  const nonExcludedNodes = React.useMemo(
    () => allNodes.filter((id) => !allExcludedNodes.has(id)),
    [allNodes, allExcludedNodes],
  );

  // Restrictions
  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInputView({
    inputProps: { placeholder: "Filter nodes with RegExp" },
    helperText: "Only nodes match this regex will be regarded as roots.",
  });
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        carry(nonExcludedNodes, (ns) => (restrictRootsRegExp ? ns.filter((id) => id.match(restrictRootsRegExp)) : ns)),
      ),
    [nonExcludedNodes, restrictRootsRegExp],
  );
  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInputView({
    inputProps: { placeholder: "Filter nodes with RegExp" },
    helperText: "Only nodes match this regex will be regarded as leave.",
  });
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        carry(nonExcludedNodes, (ns) =>
          restrictLeavesRegExp ? ns.filter((id) => id.match(restrictLeavesRegExp)) : ns,
        ),
      ),
    [nonExcludedNodes, restrictLeavesRegExp],
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
    ],
  );

  const [colorByView, colorBy] = useSelectView<ColorByMode>(
    {
      label: "Color nodes by",
      defaultValue: "color-by-heat-both",
    },
    [
      { value: "color-by-depth", label: "File depth" },
      { value: "color-by-heat-both", label: "Connections" },
      { value: "color-by-heat-target", label: "Connections (dependency)" },
      { value: "color-by-heat-source", label: "Connections (dependant)" },
    ],
  );
  const [fixNodeOnDragEndView, fixNodeOnDragEnd] = useCheckboxView({
    label: "Fix node on drag end",
    defaultValue: true,
  });
  const [renderAsTextView, renderAsText] = useCheckboxView({
    label: "Render as Text",
    defaultValue: true,
  });
  const [fixFontSizeView, fixFontSize] = useCheckboxView({
    label: "Fix font size to canvas",
    defaultValue: true,
    inputProps: {
      isDisabled: !renderAsText,
    },
  });
  const [fixedFontSizeView, fixedFontSize] = useNumberInputView({
    label: "Fixed Font Size",
    defaultValue: 4,
    inputProps: {
      keepWithinRange: true,
      clampValueOnBlur: true,
      min: 1,
      isDisabled: !fixFontSize || !renderAsText,
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
    },
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

  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [ref, render] = useGraph<HTMLDivElement>(
    {
      value: selectedNode,
      setValue: setSelectedNode,
    },
    {
      data,
      renderAsText,
      fixedFontSize: (fixFontSize && fixedFontSize) || undefined,
      fixNodeOnDragEnd,
      width: vizContainerSize?.width || 0,
      height: vizContainerSize?.height || 0,
      enableDagMode: graphMode === "dag",
      colorBy,
    },
  );

  const graphData = React.useMemo(
    () =>
      filterGraphData(data, {
        roots: restrictedRoots,
        leave: restrictedLeaves,
        excludes: allExcludedNodes,
        graphMode,
      }),
    [data, restrictedRoots, restrictedLeaves, graphMode, allExcludedNodes],
  );

  React.useEffect(() => {
    render?.(graphData);
  }, [render, graphData]);

  const [nodeSelectionHistory, setNodeSelectionHistory] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (selectedNode) {
      setNodeSelectionHistory((history) => [selectedNode, ...history.filter((node) => node !== selectedNode)]);
    }
  }, [selectedNode]);

  // The in-views
  const [inViewView, inView, setInView] = useSwitchView({
    label: "Hide nodes not rendered in viz",
    defaultValue: true,
  });
  const renderedNodes = React.useMemo(() => graphData?.nodes.map((node) => node.id), [graphData.nodes]);
  const leavesInView = React.useMemo(
    () => renderedNodes.filter((id) => graphData.links.every(({ source }) => source !== id)),
    [renderedNodes, graphData.links],
  );
  const rootsInView = React.useMemo(
    () => renderedNodes.filter((id) => graphData.links.every(({ target }) => target !== id)),
    [renderedNodes, graphData.links],
  );

  const renderedEntries = React.useMemo(
    () =>
      entries
        .filter(([entry]) => renderedNodes.includes(entry))
        .map(([entry, dependencies]) => [
          entry,
          dependencies.filter(([dependency]) => renderedNodes.includes(dependency)),
        ]) satisfies DependencyEntry[],
    [entries, renderedNodes],
  );

  return (
    <HStack display="inline-flex" alignItems="stretch" spacing={0} maxHeight="100%" height="100%">
      <VStack alignItems="stretch" height="100vh" width={width}>
        <HStack justifyContent="space-between" padding={1}>
          {backButton}
          {vizModeView}
        </HStack>
        <Divider />
        <Box ref={vizContainerRef} flex={1} overflowY="auto">
          <div ref={ref} style={{ display: vizMode === "table" ? "none" : undefined }} />
          <div style={{ display: vizMode === "graph" ? "none" : undefined }}>
            <EntriesTable entries={renderedEntries} onClickSelect={setSelectedNode} />
          </div>
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
                <div>
                  {graphMode === "cycles-only" && (
                    <ModalButton
                      title={"Cycles"}
                      renderTrigger={({ onOpen }) => <Button onClick={onOpen}>Checkout Cycles</Button>}
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
                  )}
                </div>
                <div>{colorByView}</div>
                <div>{fixNodeOnDragEndView}</div>
                <div>{renderAsTextView}</div>
                <div>{fixFontSizeView}</div>
                <div>{fixedFontSizeView}</div>
              </VStack>
            </CollapsibleSection>
          )}
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
                    set ? renderedNodes.filter((id) => set.has(id)) : [],
                  )}
                  mapProps={(id) => ({ onSelect: () => setSelectedNode(id) })}
                />
                <Heading as="h3" size="sm">
                  Dependents
                </Heading>
                <NodeList
                  nodes={carry(data.dependantMap.get(selectedNode), (set) =>
                    set ? renderedNodes.filter((id) => set.has(id)) : [],
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
          <CollapsibleSection label={`Root Nodes (source files)`}>
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
          <CollapsibleSection label={`Leaf Nodes (dependencies)`}>
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
