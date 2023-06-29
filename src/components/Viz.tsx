import {
  Accordion,
  Box,
  FormControl,
  FormLabel,
  Heading,
  List,
  ListItem,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
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
import { NodeList } from "./NodeList";
import { OpenInVSCode } from "./OpenInVSCode";

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

  const [findPathToNodeInputView, findPathToNodeRegExp] = useRegExpInputView("");
  const nodesToFind = React.useMemo(() => {
    const nodes: string[] = [];
    if (findPathToNodeRegExp !== null) {
      for (const node of data.nodes) {
        if (node.match(findPathToNodeRegExp)) nodes.push(node);
      }
    }
    return nodes;
  }, [data.nodes, findPathToNodeRegExp]);

  const pathToNode = React.useMemo(() => {
    const findPathToNode = (start: string, target: string, map: Map<string, Set<string>>) => {
      const traversed = new Set<string>();
      const go = (cur: string, path: string[] = [cur]): string[][] | void => {
        if (cur === target) return [path];

        if (traversed.has(cur)) return;
        traversed.add(cur);

        const items = map.get(cur);
        if (items) {
          const results: string[][] = [];
          for (const item of items) {
            const result = go(item, path.concat(item));
            if (result) {
              results.push(...result);
            }
          }
          if (results.length > 0) {
            return results;
          }
        }
      };
      return go(start);
    };

    const [nodeToFind] = nodesToFind;
    if (selectedNode && nodeToFind) {
      return {
        dependency: findPathToNode(selectedNode, nodeToFind, data.dependencyMap),
        dependant: findPathToNode(selectedNode, nodeToFind, data.dependantMap),
      };
    }
  }, [nodesToFind, data.dependantMap, data.dependencyMap, selectedNode]);

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
  const [nodesInViewInputView, nodesInViewRegExp] = useRegExpInputView();
  const nodesInView = React.useMemo(
    () => renderedNodeIds.filter((id) => !nodesInViewRegExp || id.match(nodesInViewRegExp)),
    [renderedNodeIds, nodesInViewRegExp]
  );

  return (
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
        <Accordion allowMultiple defaultIndex={[1, 4]} minW={0}>
          <CollapsibleSection label={`Viz configs`}>
            <div>{dagPruneModeView}</div>
            <div>{dagModeView}</div>
            <div>{colorByView}</div>
            <div>{fixNodeOnDragEndView}</div>
            <div>{renderAsTextView}</div>
            <div>{fixFontSizeView}</div>
            <div>{fixedFontSizeView}</div>
          </CollapsibleSection>
          <CollapsibleSection label={`Selected Node`}>
            {selectedNode ? (
              <>
                <Text as="h3" fontSize="lg">
                  {selectedNode}
                </Text>
                <FormControl display="flex" alignItems="center" columnGap={1}>
                  <Switch
                    isChecked={
                      excludedDependentsNodes.some((id) => id === selectedNode) ||
                      excludedDependenciesNodes.some((id) => id === selectedNode)
                    }
                    onChange={() => toggleExcludeNode(selectedNode)}
                  />
                  <FormLabel mb={0}>Exclude</FormLabel>
                </FormControl>
                <OpenInVSCode filePath={selectedNode} />
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
                  data={[...(data.dependencyMap.get(selectedNode) || [])].filter((id) => renderedNodeIds.includes(id))}
                  mapProps={(id) => ({
                    onSelect: () => setSelectedNode(id),
                    label: id,
                  })}
                />
                <Heading as="h3" size="sm">
                  Dependents
                </Heading>
                <NodeList
                  data={[...(data.dependantMap.get(selectedNode) || [])].filter((id) => renderedNodeIds.includes(id))}
                  mapProps={(id) => ({
                    onSelect: () => setSelectedNode(id),
                    label: id,
                  })}
                />
                {/* <Button onClick={() => excludeNodeDependents(selectedNode)}>
                      Toggle exclude its dependents
                    </Button>
                    <Button onClick={() => excludeNodeDependencies(selectedNode)}>
                      Toggle exclude its dependencies
                    </Button>
                    <Button disabled>TODO: Add to root nodes</Button>
                */}
                <Heading as="h3" size="sm">
                  Path to node
                </Heading>
                {findPathToNodeInputView}

                <Heading as="h4" size="sm">
                  Dependents
                </Heading>
                {pathToNode?.dependant &&
                  pathToNode.dependant.map((d, index) => (
                    <NodeList
                      key={index}
                      data={d}
                      mapProps={(id) => ({
                        onSelect: () => setSelectedNode(id),
                        label: id,
                      })}
                    />
                  ))}

                <Heading as="h4" size="sm">
                  Dependencies
                </Heading>
                {pathToNode?.dependency &&
                  pathToNode.dependency.map((d, index) => (
                    <NodeList
                      key={index}
                      data={d}
                      mapProps={(id) => ({
                        onSelect: () => setSelectedNode(id),
                        label: id,
                      })}
                    />
                  ))}
              </>
            ) : (
              "No selection yet"
            )}
          </CollapsibleSection>
          <CollapsibleSection label={`Root Nodes (dependencies, on the right)`}>
            {restrictRootInputView}
            <NodeList
              data={rootsInView}
              mapProps={(id) => ({
                onExclude: () => toggleExcludeNodeDependents(id),
                onSelect: () => setSelectedNode(id),
                label: <span>{id}</span>,
              })}
            />
          </CollapsibleSection>
          <CollapsibleSection label={`Leaf Nodes (source files, on the left)`}>
            {restrictLeavesInputView}
            <NodeList
              data={leavesInView}
              mapProps={(id) => ({
                onExclude: () => toggleExcludeNodeDependencies(id),
                onSelect: () => setSelectedNode(id),
                label: <span>{id}</span>,
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
                  data={excludedDependentsNodes}
                  mapProps={(id) => ({
                    label: id,
                    onCancel: () => toggleExcludeNodeDependents(id),
                  })}
                />
              </VStack>
              <VStack alignItems="flex-start" as="section" spacing={0}>
                <Heading as="h3" size="sm">
                  Exclude Dependencies of Them
                </Heading>
                <NodeList
                  data={excludedDependenciesNodes}
                  mapProps={(id) => ({
                    label: id,
                    onCancel: () => toggleExcludeNodeDependencies(id),
                  })}
                />
              </VStack>
              <VStack alignItems="flex-start" as="section" spacing={0}>
                <Heading as="h3" size="sm">
                  Exclude with regex
                </Heading>
                {excludeNodesFilterInputView}
                <NodeList
                  data={excludedNodesFromInput}
                  mapProps={(id) => ({
                    label: id,
                  })}
                />
              </VStack>
            </VStack>
          </CollapsibleSection>
          <CollapsibleSection label={`Look up nodes in view (${renderData?.nodes.length || 0} in total)`}>
            {nodesInViewInputView}
            <NodeList
              data={nodesInView}
              mapProps={(id) => ({
                onExclude: () => toggleExcludeNode(id),
                onSelect: () => setSelectedNode(id),
                label: <span>{id}</span>,
              })}
            />
          </CollapsibleSection>
          <CollapsibleSection label={`Cycles (${cycles.length} in total)`}>
            <List>
              {cycles.map((cycle) => (
                <ListItem key={cycle.join()}>
                  <NodeList
                    data={cycle}
                    mapProps={(id) => ({
                      label: id,
                      onSelect: () => setSelectedNode(id),
                    })}
                  />
                </ListItem>
              ))}
            </List>
          </CollapsibleSection>
        </Accordion>
      </VStack>
    </Box>
  );
}
