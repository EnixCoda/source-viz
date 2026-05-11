import { Button, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { DependencyEntry, entryParsers } from "../services/serializers";

type Diff = {
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: number;
  removedEdges: number;
};

function edgeKey(a: string, b: string): string {
  return `${a}\u0001${b}`;
}

function entriesToEdgeSet(entries: DependencyEntry[]): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const [file, deps] of entries) {
    nodes.add(file);
    for (const [dep] of deps) {
      nodes.add(dep);
      edges.add(edgeKey(file, dep));
    }
  }
  return { nodes, edges };
}

function computeDiff(baseline: DependencyEntry[], current: DependencyEntry[]): Diff {
  const a = entriesToEdgeSet(baseline);
  const b = entriesToEdgeSet(current);
  const addedNodes: string[] = [];
  const removedNodes: string[] = [];
  for (const n of b.nodes) if (!a.nodes.has(n)) addedNodes.push(n);
  for (const n of a.nodes) if (!b.nodes.has(n)) removedNodes.push(n);
  let addedEdges = 0;
  let removedEdges = 0;
  for (const e of b.edges) if (!a.edges.has(e)) addedEdges++;
  for (const e of a.edges) if (!b.edges.has(e)) removedEdges++;
  return {
    addedNodes: addedNodes.sort(),
    removedNodes: removedNodes.sort(),
    addedEdges,
    removedEdges,
  };
}

export function DiffSection({
  currentEntries,
  onFocusNode,
}: {
  currentEntries: DependencyEntry[];
  onFocusNode: (id: string) => void;
}) {
  const [baseline, setBaseline] = React.useState<{ name: string; entries: DependencyEntry[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const onPick = (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "json" && ext !== "csv") {
      setError("Please choose a .json or .csv scan export.");
      return;
    }
    file
      .text()
      .then((text) => {
        const parser = entryParsers[ext as "json" | "csv"];
        const entries = parser(text);
        setBaseline({ name: file.name, entries });
      })
      .catch((e) => setError(String(e?.message ?? e)));
  };

  const diff = React.useMemo(
    () => (baseline ? computeDiff(baseline.entries, currentEntries) : null),
    [baseline, currentEntries]
  );

  return (
    <VStack alignItems="stretch" spacing={1}>
      <Heading as="h3" size="xs" color="gray.600">Diff vs baseline</Heading>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          // allow choosing the same file again
          e.target.value = "";
        }}
      />
      <HStack spacing={1}>
        <Button size="xs" variant="outline" onClick={() => fileRef.current?.click()}>
          {baseline ? "Replace baseline…" : "Load baseline (JSON/CSV)…"}
        </Button>
        {baseline && (
          <Button size="xs" variant="ghost" onClick={() => setBaseline(null)}>Clear</Button>
        )}
      </HStack>
      {error && (
        <Text fontSize="xs" color="red.500">{error}</Text>
      )}
      {baseline && diff && (
        <VStack alignItems="stretch" spacing={1} pt={1}>
          <Text fontSize="xs" color="gray.500" noOfLines={1} title={baseline.name}>
            baseline: <b>{baseline.name}</b>
          </Text>
          <HStack spacing={3} fontSize="xs">
            <Text color="green.600">+{diff.addedNodes.length} nodes</Text>
            <Text color="red.600">−{diff.removedNodes.length} nodes</Text>
            <Text color="green.600">+{diff.addedEdges} edges</Text>
            <Text color="red.600">−{diff.removedEdges} edges</Text>
          </HStack>
          {diff.addedNodes.length > 0 && (
            <DiffNodeList title={`Added nodes (${diff.addedNodes.length})`} color="green.700" nodes={diff.addedNodes} onClick={onFocusNode} />
          )}
          {diff.removedNodes.length > 0 && (
            <DiffNodeList title={`Removed nodes (${diff.removedNodes.length})`} color="red.700" nodes={diff.removedNodes} onClick={() => {}} disabled />
          )}
        </VStack>
      )}
    </VStack>
  );
}

function DiffNodeList({
  title,
  color,
  nodes,
  onClick,
  disabled,
}: {
  title: string;
  color: string;
  nodes: string[];
  onClick: (id: string) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const display = expanded ? nodes : nodes.slice(0, 5);
  return (
    <VStack alignItems="stretch" spacing={0}>
      <Text fontSize="xs" color={color} fontWeight="semibold">{title}</Text>
      {display.map((n) => (
        <Text
          key={n}
          as={disabled ? "span" : "button"}
          fontSize="xs"
          fontFamily="mono"
          textAlign="left"
          color={disabled ? "gray.500" : undefined}
          textDecoration={disabled ? "line-through" : undefined}
          cursor={disabled ? "default" : "pointer"}
          _hover={disabled ? undefined : { bg: "gray.100" }}
          px={1}
          py={0.5}
          noOfLines={1}
          title={n}
          onClick={disabled ? undefined : () => onClick(n)}
        >
          {n}
        </Text>
      ))}
      {nodes.length > 5 && (
        <Text
          as="button"
          fontSize="xs"
          color="blue.500"
          textAlign="left"
          px={1}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show ${nodes.length - 5} more…`}
        </Text>
      )}
    </VStack>
  );
}
