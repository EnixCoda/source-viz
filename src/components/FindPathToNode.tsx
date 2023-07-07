import { Button, Heading, ModalBody, ModalFooter, Select, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { PreparedData } from "../utils/getData";
import { ListOfNodeList } from "./ListOfNodeList";
import { ModalButton } from "./ModalButton";
import { MonoText } from "./MonoText";
import { NodeList } from "./NodeList";
import { NodesFilter } from "./NodesFilter";

export function FindPathToNode({
  nodes,
  data,
  selectedNode: source,
  nodeSelectionHistory,
  setSelectedNode,
}: {
  nodes: string[];
  data: PreparedData;
  selectedNode: string;
  nodeSelectionHistory?: string[];
  setSelectedNode: (id: string | null) => void;
}) {
  const [step, setStep] = React.useState<"selectTarget" | "checkResult">("selectTarget");
  const [target, setTarget] = React.useState<string | null>(null);

  const allPaths = React.useMemo(() => {
    if (!(source && target)) return;

    const findPathToNode = (start: string, target: string, map: Map<string, Set<string>>) => {
      const traversed = new Set<string>();
      const paths: string[][] = [];
      const go = (cur: string, path: string[] = [cur]): void => {
        if (cur === target) {
          paths.push(path);
          return;
        }

        if (traversed.has(cur)) return;
        traversed.add(cur);

        const items = map.get(cur);
        if (items) {
          for (const item of items) {
            go(item, path.concat(item));
          }
        }
      };
      go(start);

      return paths;
    };
    return {
      dependency: findPathToNode(source, target, data.dependencyMap),
      dependant: findPathToNode(source, target, data.dependantMap),
    };
  }, [source, target, data.dependantMap, data.dependencyMap]);

  return (
    <>
      <Heading as="h3" size="sm">
        Find path to another node
      </Heading>
      <ModalButton
        title={"Find path to another node"}
        renderTrigger={({ onOpen }) => <Button onClick={onOpen}>Select node</Button>}
      >
        {({ onClose }) => {
          switch (step) {
            case "selectTarget":
              return (
                <ModalBody>
                  <VStack align="stretch">
                    <Heading as="h3" size="sm">
                      From
                    </Heading>
                    <MonoText>{source}</MonoText>
                    {nodeSelectionHistory && (
                      <>
                        <Heading as="h3" size="sm">
                          To a recently selected node
                        </Heading>
                        <Select
                          value=""
                          placeholder="Find path to a recently selected node"
                          onChange={(e) => {
                            setTarget(e.target.value);
                            setStep("checkResult");
                          }}
                        >
                          {/* slice 1 to exclude current selection */}
                          {nodeSelectionHistory.slice(1).map((node) => (
                            <option key={node} value={node}>
                              {node}
                            </option>
                          ))}
                        </Select>
                      </>
                    )}
                    <Heading as="h3" size="sm">
                      To a node in viz
                    </Heading>
                    <NodesFilter
                      nodes={nodes}
                      mapProps={(id) => ({
                        onSelect: () => {
                          setTarget(id);
                          setStep("checkResult");
                        },
                      })}
                      listProps={{
                        maxHeight: 540,
                      }}
                    />
                  </VStack>
                </ModalBody>
              );
            case "checkResult": {
              if (!target) return null;

              return (
                <>
                  <ModalBody>
                    {/* TODO: use a button to trigger single node selection modal dialog */}
                    <Text size="sm">Below shows paths between such nodes</Text>
                    <NodeList nodes={[source, target]} />
                    <Heading as="h4" size="sm">
                      In dependents' direction
                    </Heading>
                    <ListOfNodeList
                      lists={allPaths?.dependant}
                      getProps={() => ({
                        mapProps: (id) => ({
                          onSelect: () => {
                            setSelectedNode(id);
                            onClose();
                            setStep("selectTarget");
                          },
                        }),
                      })}
                    />

                    <Heading as="h4" size="sm">
                      In dependencies' direction
                    </Heading>
                    <ListOfNodeList
                      lists={allPaths?.dependency}
                      getProps={() => ({
                        mapProps: (id) => ({
                          onSelect: () => {
                            setSelectedNode(id);
                            onClose();
                            setStep("selectTarget");
                          },
                        }),
                      })}
                    />
                  </ModalBody>
                  <ModalFooter gap={2}>
                    <Button variant="ghost" onClick={() => setStep("selectTarget")}>
                      Back
                    </Button>
                    <Button onClick={onClose}>Done</Button>
                  </ModalFooter>
                </>
              );
            }
          }
        }}
      </ModalButton>
    </>
  );
}
