import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
  Accordion,
  Box,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  IconButton,
  Switch
} from "@chakra-ui/react";
import * as React from "react";
import { useGraph } from "../hooks/useGraph";
import { useSet } from "../hooks/useSet";
import { useCheckboxView } from "../hooks/view/useCheckboxView";
import { useInputView } from "../hooks/view/useInputView";
import { useRegExpInputView } from "../hooks/view/useRegExpInputView";
import { useSelectView } from "../hooks/view/useSelectView";
import { getData, PreparedData } from "../utils/getData";
import { DAGDirections } from "../utils/graphDecorators";
import { CollapsibleSection } from "./CollapsibleSection";
import { NodeList } from "./NodeList";

export function Viz({ data, setData }: { data: PreparedData; setData: (data: PreparedData) => void }) {
  // Use views
  const [renderAsTextView, renderAsText] = useCheckboxView("Render as Text", true);
  const [fixNodeOnDragEndView, fixNodeOnDragEnd] = useCheckboxView("Fix node on drag end", true);
  const [dagPruneModeView, dagPruneMode] = useSelectView(
    "DAG Prune Mode: ",
    [
      { value: "less roots", label: "Less roots" },
      { value: "less leaves", label: "Less leaves" },
    ],
    "less roots"
  );
  const [dagModeView, dagMode] = useSelectView<DAGDirections | "">(
    "DAG Mode: ",
    [
      { value: "", label: "Disable (render circular references)" },
      { value: "lr", label: "Left to Right" },
      { value: "rl", label: "Right to Left" },
      { value: "td", label: "Top to Bottom" },
      { value: "bu", label: "Bottom to Top" },
      { value: "radialout", label: "Radial Out" },
      { value: "radialin", label: "Radial In" },
    ],
    "lr"
  );
  const [repositoryInputView, repositoryInput] = useInputView("", {
    placeholder: "/path/to/repository/",
  });

  // Excludes
  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView("test");
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? [...data.nodes.keys()].filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [excludeNodesFilterRegExp, data.nodes]
  );
  const [excludedDependentsNodes, toggleExcludeNodeDependents] = useSet<string>();
  const [excludedDependenciesNodes, toggleExcludeNodeDependencies] = useSet<string>();
  const toggleExcludeNode = React.useCallback((id: string) => {
    toggleExcludeNodeDependencies(id);
    toggleExcludeNodeDependents(id);
  }, []);
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
  const [ref, render, selectedNode, setSelectedNode] = useGraph({
    data,
    dagMode,
    fixNodeOnDragEnd,
    renderAsText,
  });

  const getDataOptions = React.useMemo(
    () => ({
      roots: restrictedRoots,
      leaves: restrictedLeaves,
      preventCycle: dagMode !== "",
      dagPruneMode,
      excludeUp: allExcludedNodes,
      excludeDown: allExcludedNodes,
    }),
    [restrictedRoots, restrictedLeaves, dagMode, dagPruneMode, allExcludedNodes]
  );

  const renderData = React.useMemo(() => getData(data, getDataOptions), [data, getDataOptions]);
  React.useEffect(() => {
    render?.(renderData);
  }, [render, renderData]);

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
    <Box display="flex" overflow="auto">
      <div ref={ref} />
      <Box display="flex" flexDirection="column" flex={1} gap={2} maxHeight="100%" overflow="auto" maxWidth={720}>
        <Accordion allowMultiple defaultIndex={[1, 4]}>
          <CollapsibleSection label={`Viz configs`}>
            <div>{dagPruneModeView}</div>
            <div>{dagModeView}</div>
            <div>{renderAsTextView}</div>
            <div>{fixNodeOnDragEndView}</div>
          </CollapsibleSection>
          <CollapsibleSection label={`Selected Node`}>
            {selectedNode ? (
              <>
                <code>{selectedNode}</code>
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
                <FormControl>
                  <Box display="flex" columnGap={1}>
                    <IconButton
                      aria-label="Open in VS Code"
                      icon={<ExternalLinkIcon />}
                      disabled={!(repositoryInput && selectedNode.includes("/"))}
                      onClick={() => {
                        const isValidFilePath = repositoryInput && selectedNode.includes("/");
                        if (isValidFilePath) window.open(`vscode://file${repositoryInput + selectedNode}`);
                      }}
                    />
                    {repositoryInputView}
                  </Box>
                  {!(repositoryInput && selectedNode.includes("/")) && (
                    <FormErrorMessage>Cannot open in VS Code</FormErrorMessage>
                  )}
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
              </>
            ) : (
              "No selection yet"
            )}
          </CollapsibleSection>
          <CollapsibleSection label={`Root Nodes Filter (on the left side)`}>
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
          <CollapsibleSection label={`Leaf Nodes Filter (on the right side)`}>
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
          <CollapsibleSection label={`Extra Nodes Filter`}>
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
            <Heading as="h3" size="sm">
              Exclude with regex
            </Heading>
            {excludeNodesFilterInputView}
            <NodeList
              data={excludedNodesFromInput}
              mapProps={(id) => ({
                label: <span>{id}</span>,
              })}
            />
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
        </Accordion>
      </Box>
    </Box>
  );
}
