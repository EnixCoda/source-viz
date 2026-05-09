import { Badge, Table, TableProps, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import * as React from "react";
import { DependencyEntry, DependencyKind } from "../../services/serializers";
import { MonoText } from "../MonoText";

const kindBadge: Record<DependencyKind, { label: string; colorScheme: string } | null> = {
  local: null,
  external: { label: "ext", colorScheme: "gray" },
  unresolved: { label: "unresolved", colorScheme: "orange" },
};

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
  return (
    <Table size="sm" {...tableProps}>
      <Thead>
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
                        onClick={() => onClickSelect(dependency)}
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                      >
                        {dependency}
                      </MonoText>
                    ) : (
                      <MonoText>{dependency}</MonoText>
                    )}
                    {badge && (
                      <Badge ml={1} colorScheme={badge.colorScheme} fontSize="0.65em">
                        {badge.label}
                      </Badge>
                    )}
                  </Td>
                  {showImportType && <Td>{isAsync ? "yes" : null}</Td>}
                </Tr>
              );
            })}
          </React.Fragment>
        ))}
      </Tbody>
    </Table>
  );
}
