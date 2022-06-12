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

export function Viz({ data }: { data: PreparedData }) {
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

  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView("test");
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? [...data.nodes.keys()].filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [data, excludeNodesFilterRegExp]
  );

  const [excludedDependantsNodes, toggleExcludeNodeDependants] = useSet<string>();
  const [excludedDependenciesNodes, toggleExcludeNodeDependencies] = useSet<string>();

  const toggleExcludeNode = React.useCallback(function toggleExcludeNode(id: string) {
    toggleExcludeNodeDependencies(id);
    toggleExcludeNodeDependants(id);
  }, []);

  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedDependantsNodes, ...excludedDependenciesNodes]),
    [excludedNodesFromInput, excludedDependantsNodes, excludedDependenciesNodes]
  );

  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInputView("^antd$");
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        [...data.dependencies.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictRootsRegExp || id.match(restrictRootsRegExp))
        )
      ),
    [data, restrictRootsRegExp, allExcludedNodes]
  );

  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInputView();
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        [...data.nodes.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictLeavesRegExp || id.match(restrictLeavesRegExp))
        )
      ),
    [data, restrictLeavesRegExp, allExcludedNodes]
  );

  const [ref, render, selectedNode, setSelectedNode] = useGraph({
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
    [dagMode, dagPruneMode, restrictedRoots, restrictedLeaves, allExcludedNodes]
  );
  const renderData = React.useMemo(() => getData(data, getDataOptions), [data, getDataOptions]);
  React.useEffect(() => {
    render?.(renderData);
  }, [render, renderData]);

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
    [renderedNodeIds]
  );

  return (
    <Box display="flex" maxHeight="100vh" overflow="auto">
      <div ref={ref} />
      <Box flex={1} maxHeight="100%" overflow="auto" maxWidth={720}>
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
                      excludedDependantsNodes.some((id) => id === selectedNode) ||
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
                {/* excludedDependants: excludedDependantsNodes.some(
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
                  Dependants
                </Heading>
                <NodeList
                  data={[...(data.dependantMap.get(selectedNode) || [])].filter((id) => renderedNodeIds.includes(id))}
                  mapProps={(id) => ({
                    onSelect: () => setSelectedNode(id),
                    label: id,
                  })}
                />
                {/* <Button onClick={() => excludeNodeDependants(selectedNode)}>
                      Toggle exclude its dependants
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
          <CollapsibleSection label={`Restrict Root Nodes`}>
            {restrictRootInputView}
            <NodeList
              data={[...restrictedRoots]}
              mapProps={(id) => ({
                label: <span>{id}</span>,
              })}
            />
          </CollapsibleSection>
          <CollapsibleSection label={`Root Nodes in View`}>
            <NodeList
              data={rootsInView}
              mapProps={(id) => ({
                onExclude: () => toggleExcludeNodeDependants(id),
                onSelect: () => setSelectedNode(id),
                label: <span>{id}</span>,
              })}
            />
          </CollapsibleSection>
          <CollapsibleSection label={`Restrict Leaf Nodes`}>
            {restrictLeavesInputView}
            <NodeList
              data={[...restrictedLeaves]}
              mapProps={(id) => ({
                label: <span>{id}</span>,
              })}
            />
          </CollapsibleSection>
          <CollapsibleSection label={`Leaf Nodes in View`}>
            <NodeList
              data={leavesInView}
              mapProps={(id) => ({
                onExclude: () => toggleExcludeNodeDependencies(id),
                onSelect: () => setSelectedNode(id),
                label: <span>{id}</span>,
              })}
            />
          </CollapsibleSection>
          <CollapsibleSection label={`Exclude Nodes`}>
            <Heading as="h3" size="sm">
              Exclude Dependants of Them
            </Heading>
            <NodeList
              data={excludedDependantsNodes}
              mapProps={(id) => ({
                label: id,
                onCancel: () => toggleExcludeNodeDependants(id),
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
