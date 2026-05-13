import { Badge, Box, TableProps } from "@chakra-ui/react";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DependencyEntry, DependencyKind } from "../../services/serializers";
import { useSelection } from "../../contexts/SelectionContext";
import { MonoText } from "../MonoText";

const kindBadge: Record<DependencyKind, { label: string; colorScheme: string } | null> = {
  local: null,
  external: { label: "ext", colorScheme: "gray" },
  unresolved: { label: "unresolved", colorScheme: "orange" },
};

interface FlatRow {
  file: string;
  dependency: string;
  isAsync: boolean;
  kind: DependencyKind;
  isFirstInFile: boolean;
}

const ROW_HEIGHT = 33;
const COL_FILE = "45%";

export function EntriesTable({
  entries,
  showImportType,
}: {
  entries: DependencyEntry[];
  showImportType?: boolean;
  tableProps?: TableProps;
  order?: Order;
}) {
  const { setSelectedNode: onClickSelect } = useSelection();
  const flatRows = React.useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const [file, dependencies] of entries) {
      for (let i = 0; i < dependencies.length; i++) {
        const [dependency, isAsync, kind] = dependencies[i];
        rows.push({ file, dependency, isAsync, kind, isFirstInFile: i === 0 });
      }
    }
    return rows;
  }, [entries]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden" fontSize="xs" fontFamily="mono">
      {/* Sticky header */}
      <Box
        display="flex"
        flexShrink={0}
        borderBottom="2px solid"
        borderColor="gray.200"
        bg="gray.50"
        px={2}
        py={1}
        fontWeight="semibold"
        fontSize="0.7em"
        textTransform="uppercase"
        letterSpacing="wider"
        color="gray.500"
      >
        <Box width={COL_FILE} flexShrink={0}>File</Box>
        <Box flex="1" minW={0}>Dependency</Box>
        {showImportType && <Box width="80px" flexShrink={0}>Async</Box>}
      </Box>

      {/* Virtual scroll body */}
      <Box ref={parentRef} flex="1" overflow="auto">
        <Box height={`${virtualizer.getTotalSize()}px`} position="relative">
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = flatRows[vItem.index];
            const badge = kindBadge[row.kind];
            return (
              <Box
                key={vItem.key}
                position="absolute"
                top={0}
                left={0}
                right={0}
                transform={`translateY(${vItem.start}px)`}
                height={`${ROW_HEIGHT}px`}
                display="flex"
                alignItems="center"
                px={2}
                borderBottom="1px solid"
                borderColor="gray.100"
                _hover={{ bg: "gray.50" }}
              >
                {/* File column */}
                <Box width={COL_FILE} flexShrink={0} minW={0} overflow="hidden" pr={2}>
                  {row.isFirstInFile ? (
                    <MonoText
                      as="button"
                      textAlign="left"
                      onClick={() => onClickSelect(row.file)}
                      color="blue.600"
                      style={{ cursor: "pointer" }}
                      isTruncated
                      maxWidth="100%"
                      display="block"
                    >
                      {row.file}
                    </MonoText>
                  ) : null}
                </Box>

                {/* Dependency column */}
                <Box flex="1" minW={0} overflow="hidden" display="flex" alignItems="center" gap={1}>
                  <MonoText
                    as="button"
                    textAlign="left"
                    onClick={() => onClickSelect(row.dependency)}
                    color="blue.600"
                    style={{ cursor: "pointer" }}
                    isTruncated
                    maxWidth="100%"
                    display="block"
                  >
                    {row.dependency}
                  </MonoText>
                  {badge && (
                    <Badge flexShrink={0} colorScheme={badge.colorScheme} fontSize="0.6em">
                      {badge.label}
                    </Badge>
                  )}
                </Box>

                {showImportType && (
                  <Box width="80px" flexShrink={0} color="gray.500">
                    {row.isAsync ? "yes" : null}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
