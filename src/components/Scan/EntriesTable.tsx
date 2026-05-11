import { Badge, Box, Table, TableProps, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DependencyEntry, DependencyKind } from "../../services/serializers";
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

export function EntriesTable({
  entries,
  showImportType,
  tableProps,
  onClickSelect,
}: {
  entries: DependencyEntry[];
  showImportType?: boolean;
  tableProps?: TableProps;
  order?: Order;
  onClickSelect?: (dependency: string) => void;
}) {
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
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <Table size="sm" {...tableProps}>
      <Thead position="sticky" top={0} zIndex={1} bg="white">
        <Tr>
          <Th>File</Th>
          <Th>Dependencies</Th>
          {showImportType && (
            <Th width="0%" whiteSpace="nowrap">
              is async import
            </Th>
          )}
        </Tr>
      </Thead>
      <Tbody>
        {entries.map(([file, dependencies]) => (
          <React.Fragment key={file}>
            {dependencies.map(([dependency, isAsync, kind], index, arr) => {
              const badge = kindBadge[kind];
              return (
                <Tr key={`${index}-${dependency}-${isAsync}`} verticalAlign="baseline">
                  {index === 0 ? (
                    <Td rowSpan={arr.length}>
                      {onClickSelect ? (
                        <MonoText
                          as="button"
                          textAlign="left"
                          onClick={() => onClickSelect(dependency)}
                          style={{ cursor: "pointer", textDecoration: "underline" }}
                        >
                          {file}
                        </MonoText>
                      ) : (
                        <MonoText>{file}</MonoText>
                      )}
                    </Td>
                  ) : null}
                  <Td>
                    {onClickSelect ? (
                      <MonoText
                        as="button"
                        textAlign="left"
                        onClick={() => onClickSelect(row.file)}
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                      >
                        {row.file}
                      </MonoText>
                    ) : (
                      <MonoText>{row.file}</MonoText>
                    )
                  )}
                </Box>
                <Box flex="1" minW={0} isTruncated>
                  {onClickSelect ? (
                    <MonoText
                      as="button"
                      textAlign="left"
                      onClick={() => onClickSelect(row.dependency)}
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                    >
                      {row.dependency}
                    </MonoText>
                  ) : (
                    <MonoText>{row.dependency}</MonoText>
                  )}
                  {badge && (
                    <Badge ml={1} colorScheme={badge.colorScheme} fontSize="0.65em">
                      {badge.label}
                    </Badge>
                  )}
                </Box>
                {showImportType && (
                  <Box width="auto" whiteSpace="nowrap">
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
