import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { DependencyKind } from "../services/serializers";
import { PreparedData } from "../utils/graphData";
import { carry } from "../utils/general";
import { InvestigatorFs } from "../lib/usage-investigator";
import { FindPathToNode } from "./FindPathToNode";
import { FormSwitch } from "./FormSwitch";
import { MonoText } from "./MonoText";
import { NodeList } from "./NodeList";
import { OpenInVSCode } from "./OpenInVSCode";

export function NodeInspector({
  selectedNodes,
  selectedNode,
  data,
  renderedNodes,
  kindMap,
  nodeSelectionHistory,
  historyOffset,
  setHistoryOffset,
  setSelectedNode,
  setSelectedNodes,
  allExcludedNodes,
  toggleExcludeNode,
  investigatorFs,
  setInvestigateTarget,
}: {
  selectedNodes: Set<string>;
  selectedNode: string | null;
  data: PreparedData;
  renderedNodes: string[];
  kindMap: Map<string, DependencyKind>;
  nodeSelectionHistory: string[];
  historyOffset: number;
  setHistoryOffset: (fn: (o: number) => number) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedNodes: (s: Set<string>) => void;
  allExcludedNodes: Set<string>;
  toggleExcludeNode: (id: string) => void;
  investigatorFs: InvestigatorFs | null;
  setInvestigateTarget: (t: { file: string; symbol?: string | null } | null) => void;
}) {
  // Multi-select view
  if (selectedNodes.size > 1) {
    return (
      <VStack alignItems="flex-start" spacing={2}>
        <Text fontSize="sm" color="gray.600">
          {selectedNodes.size} nodes selected (Ctrl/Cmd+click to toggle)
        </Text>
        <HStack>
          <Button size="xs" onClick={() => setSelectedNodes(new Set())}>
            Clear
          </Button>
          <Button
            size="xs"
            colorScheme="red"
            variant="outline"
            onClick={() => {
              selectedNodes.forEach((id) => {
                if (!allExcludedNodes.has(id)) toggleExcludeNode(id);
              });
              setSelectedNodes(new Set());
            }}
          >
            Exclude all
          </Button>
        </HStack>
        <NodeList
          nodes={[...selectedNodes]}
          kindMap={kindMap}
          mapProps={(id) => ({
            onSelect: () => setSelectedNode(id),
            onExclude: () => toggleExcludeNode(id),
          })}
        />
      </VStack>
    );
  }

  if (!selectedNode) {
    return (
      <Text color="gray.500" fontSize="sm" px={2} py={4}>
        Click a node in the graph or pick one from any list to inspect it.
      </Text>
    );
  }

  const displayedNode = nodeSelectionHistory[historyOffset] ?? selectedNode;
  const imports = carry(data.dependencyMap.get(displayedNode), (set) =>
    set ? renderedNodes.filter((id) => set.has(id)) : []
  );
  const importedBy = carry(data.dependantMap.get(displayedNode), (set) =>
    set ? renderedNodes.filter((id) => set.has(id)) : []
  );

  return (
    <VStack alignItems="stretch" spacing={2} height="100%">
      <HStack px={1}>
        <Tooltip label="Previous selection" hasArrow>
          <IconButton
            aria-label="Previous node"
            icon={<ChevronLeftIcon />}
            size="xs"
            variant="ghost"
            isDisabled={historyOffset >= nodeSelectionHistory.length - 1}
            onClick={() => setHistoryOffset((o) => o + 1)}
          />
        </Tooltip>
        <Tooltip label="Next selection" hasArrow>
          <IconButton
            aria-label="Next node"
            icon={<ChevronRightIcon />}
            size="xs"
            variant="ghost"
            isDisabled={historyOffset <= 0}
            onClick={() => setHistoryOffset((o) => o - 1)}
          />
        </Tooltip>
        <Select
            size="xs"
            value={displayedNode ?? ""}
            onChange={(e) => {
              const idx = nodeSelectionHistory.indexOf(e.target.value);
              setHistoryOffset(() => (idx >= 0 ? idx : 0));
            }}
          >
            {nodeSelectionHistory.length === 0 ? (
              <option value="" disabled>No history</option>
            ) : (
              nodeSelectionHistory.map((node) => (
                <option key={node} value={node}>
                  {node}
                </option>
              ))
            )}
          </Select>
      </HStack>

      <Box px={2}>
        <MonoText wordBreak="break-word" fontSize="xs" color="gray.700">
          {displayedNode}
        </MonoText>
        <HStack mt={1} spacing={1} flexWrap="wrap">
          {allExcludedNodes.has(displayedNode) && (
            <Badge fontSize="0.65em" colorScheme="red">excluded</Badge>
          )}
        </HStack>
        <HStack mt={2} spacing={1} flexWrap="wrap">
          <OpenInVSCode layout="text" path={displayedNode} size="xs" />
          <Button
            size="xs"
            variant="outline"
            isDisabled={!investigatorFs}
            title={!investigatorFs ? "Source files are not available for this dataset" : undefined}
            onClick={() => setInvestigateTarget({ file: displayedNode })}
          >
            Investigate
          </Button>
          <FormSwitch
            label="Exclude"
            value={allExcludedNodes.has(displayedNode)}
            onChange={() => toggleExcludeNode(displayedNode)}
          />
        </HStack>
      </Box>

      <Tabs size="sm" variant="line" isLazy flex={1} display="flex" flexDirection="column" minH={0}>
        <TabList>
          <Tab fontSize="xs">Imports ({imports.length})</Tab>
          <Tab fontSize="xs">Imported by ({importedBy.length})</Tab>
          <Tab fontSize="xs">Path</Tab>
        </TabList>
        <TabPanels flex={1} overflow="auto" minH={0}>
          <TabPanel px={0} py={1}>
            <NodeList
              nodes={imports}
              kindMap={kindMap}
              mapProps={(id) => ({
                onSelect: () => setSelectedNode(id),
                onInvestigate: investigatorFs ? () => setInvestigateTarget({ file: id }) : undefined,
              })}
            />
          </TabPanel>
          <TabPanel px={0} py={1}>
            <NodeList
              nodes={importedBy}
              kindMap={kindMap}
              mapProps={(id) => ({
                onSelect: () => setSelectedNode(id),
                onInvestigate: investigatorFs ? () => setInvestigateTarget({ file: id }) : undefined,
              })}
            />
          </TabPanel>
          <TabPanel px={1} py={2}>
            <FindPathToNode
              nodes={renderedNodes}
              data={data}
              selectedNode={displayedNode}
              setSelectedNode={setSelectedNode}
              nodeSelectionHistory={nodeSelectionHistory}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}
