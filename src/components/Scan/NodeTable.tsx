import * as React from "react";
import { Badge, Box, Input, InputGroup, InputLeftElement, Tooltip } from "@chakra-ui/react";
import { SearchIcon, TriangleDownIcon, TriangleUpIcon } from "@chakra-ui/icons";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DependencyKind } from "../../services/serializers";
import { PreparedData } from "../../utils/graphData";
import { useSelection } from "../../contexts/SelectionContext";
import { MonoText } from "../MonoText";

export interface NodeRow {
  id: string;
  fanIn: number;
  fanOut: number;
  extImports: number;
  asyncImports: number;
  inCycle: boolean;
}

type SortKey = "id" | "fanIn" | "fanOut" | "extImports" | "asyncImports";
type SortDir = "asc" | "desc";

function buildRows(
  renderedNodes: string[],
  fanInMap: Map<string, number>,
  fanOutMap: Map<string, number>,
  data: PreparedData,
  kindMap: Map<string, DependencyKind>,
  cycleNodes: Set<string>
): NodeRow[] {
  return renderedNodes.map((id) => {
    const deps = data.dependencyMap.get(id);
    let extImports = 0;
    let asyncImports = 0;
    if (deps) {
      for (const depId of deps) {
        const kind = kindMap.get(depId);
        if (kind === "external") extImports++;
        // async imports: check per-entry data via dependencyEntry isn't directly available here
        // We'll compute asyncImports later if entries are passed; leave 0 for now.
        void kind;
      }
    }
    return {
      id,
      fanIn: fanInMap.get(id) ?? 0,
      fanOut: fanOutMap.get(id) ?? 0,
      extImports,
      asyncImports,
      inCycle: cycleNodes.has(id),
    };
  });
}

const ROW_H = 30;

const COL = {
  file: "auto",
  fanIn: "52px",
  fanOut: "52px",
  ext: "48px",
  cycle: "40px",
};

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  hint,
  width,
  textAlign = "right",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
  hint?: string;
  width: string;
  textAlign?: "left" | "right";
}) {
  const active = currentKey === sortKey;
  return (
    <Tooltip label={hint} hasArrow openDelay={400} isDisabled={!hint}>
      <Box
        as="button"
        width={width}
        flexShrink={0}
        textAlign={textAlign}
        color={active ? "blue.600" : "gray.500"}
        _hover={{ color: "gray.800" }}
        display="flex"
        alignItems="center"
        justifyContent={textAlign === "right" ? "flex-end" : "flex-start"}
        gap="2px"
        onClick={() => onSort(sortKey)}
        pr={textAlign === "right" ? 1 : 0}
      >
        {active && (currentDir === "asc" ? <TriangleUpIcon boxSize="0.6em" /> : <TriangleDownIcon boxSize="0.6em" />)}
        {label}
      </Box>
    </Tooltip>
  );
}

export function NodeTable({
  renderedNodes,
  fanInMap,
  fanOutMap,
  data,
  kindMap,
  cycleNodes,
}: {
  renderedNodes: string[];
  fanInMap: Map<string, number>;
  fanOutMap: Map<string, number>;
  data: PreparedData;
  kindMap: Map<string, DependencyKind>;
  cycleNodes: Set<string>;
}) {
  const { selectedNodes, setSelectedNode, toggleSelectNode } = useSelection();
  const [filter, setFilter] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("fanIn");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const rows = React.useMemo(
    () => buildRows(renderedNodes, fanInMap, fanOutMap, data, kindMap, cycleNodes),
    [renderedNodes, fanInMap, fanOutMap, data, kindMap, cycleNodes]
  );

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? rows.filter((r) => r.id.toLowerCase().includes(q)) : rows;
  }, [rows, filter]);

  const sorted = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "id") return dir * a.id.localeCompare(b.id);
      return dir * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = React.useCallback((k: SortKey) => {
    setSortKey((prev) => {
      if (prev === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDir("desc");
      return k;
    });
  }, []);

  const parentRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 20,
  });

  const headerCell = { flexShrink: 0, px: 1 };

  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden" fontSize="xs">
      {/* Filter bar */}
      <Box px={2} py={1} flexShrink={0} borderBottom="1px solid" borderColor="gray.100">
        <InputGroup size="xs">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            pl={6}
            placeholder={`Filter ${rows.length} nodes…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            variant="filled"
            bg="gray.50"
          />
        </InputGroup>
      </Box>

      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        flexShrink={0}
        borderBottom="2px solid"
        borderColor="gray.200"
        bg="gray.50"
        px={2}
        py={0.5}
        fontWeight="semibold"
        fontSize="0.65em"
        textTransform="uppercase"
        letterSpacing="wider"
        gap={0}
      >
        <SortHeader
          {...headerCell}
          label="File"
          sortKey="id"
          currentKey={sortKey}
          currentDir={sortDir}
          onSort={handleSort}
          width={COL.file}
          textAlign="left"
        />
        <SortHeader
          {...headerCell}
          label="In"
          sortKey="fanIn"
          currentKey={sortKey}
          currentDir={sortDir}
          onSort={handleSort}
          hint="Imported by (fan-in)"
          width={COL.fanIn}
        />
        <SortHeader
          {...headerCell}
          label="Out"
          sortKey="fanOut"
          currentKey={sortKey}
          currentDir={sortDir}
          onSort={handleSort}
          hint="Imports (fan-out)"
          width={COL.fanOut}
        />
        <SortHeader
          {...headerCell}
          label="Ext"
          sortKey="extImports"
          currentKey={sortKey}
          currentDir={sortDir}
          onSort={handleSort}
          hint="External imports"
          width={COL.ext}
        />
        <Box {...headerCell} width={COL.cycle} flexShrink={0} color="gray.400" textAlign="right" pr={1}>
          Cyc
        </Box>
      </Box>

      {/* Virtual body */}
      <Box ref={parentRef} flex={1} overflow="auto">
        <Box height={`${virtualizer.getTotalSize()}px`} position="relative">
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = sorted[vItem.index];
            const isSelected = selectedNodes.has(row.id);
            return (
              <Box
                key={vItem.key}
                position="absolute"
                top={0}
                left={0}
                right={0}
                transform={`translateY(${vItem.start}px)`}
                height={`${ROW_H}px`}
                display="flex"
                alignItems="center"
                px={2}
                borderBottom="1px solid"
                borderColor="gray.100"
                bg={isSelected ? "blue.50" : undefined}
                _hover={{ bg: isSelected ? "blue.100" : "gray.50" }}
                cursor="pointer"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) toggleSelectNode(row.id);
                  else setSelectedNode(row.id);
                }}
              >
                {/* File */}
                <Box flex={1} minW={0} overflow="hidden" pr={1}>
                  <MonoText
                    isTruncated
                    color={isSelected ? "blue.700" : "inherit"}
                    fontWeight={isSelected ? "semibold" : undefined}
                    display="block"
                    maxWidth="100%"
                  >
                    {row.id}
                  </MonoText>
                </Box>
                {/* In */}
                <Box width={COL.fanIn} flexShrink={0} textAlign="right" pr={1} color="gray.600">
                  {row.fanIn > 0 ? row.fanIn : <span style={{ color: "#CBD5E0" }}>–</span>}
                </Box>
                {/* Out */}
                <Box width={COL.fanOut} flexShrink={0} textAlign="right" pr={1} color="gray.600">
                  {row.fanOut > 0 ? row.fanOut : <span style={{ color: "#CBD5E0" }}>–</span>}
                </Box>
                {/* Ext */}
                <Box width={COL.ext} flexShrink={0} textAlign="right" pr={1} color="gray.500">
                  {row.extImports > 0 ? (
                    <Badge fontSize="0.65em" colorScheme="gray">{row.extImports}</Badge>
                  ) : (
                    <span style={{ color: "#CBD5E0" }}>–</span>
                  )}
                </Box>
                {/* Cycle */}
                <Box width={COL.cycle} flexShrink={0} textAlign="right" pr={1}>
                  {row.inCycle && <Badge fontSize="0.65em" colorScheme="red">cyc</Badge>}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Footer summary */}
      {filter && (
        <Box px={2} py={0.5} flexShrink={0} borderTop="1px solid" borderColor="gray.100" color="gray.400" fontSize="0.65em">
          {sorted.length} / {rows.length} nodes
        </Box>
      )}
    </Box>
  );
}
