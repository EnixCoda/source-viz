import { Table, TableProps, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import * as React from "react";
import { DependencyEntry } from "../../services/serializers";
import { Order } from "../../types";
import { MonoText } from "../MonoText";

export function EntriesTable({
  entries,
  showImportType,
  tableProps,
  order,
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
            {dependencies.map(([dependency, isAsync], index, arr) => (
              <Tr key={`${dependency}-${isAsync}`} verticalAlign="baseline">
                {index === 0 ? (
                  <Td rowSpan={arr.length}>
                    {onClickSelect ? (
                      <MonoText
                        as="button"
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
                      onClick={() => onClickSelect(dependency)}
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                    >
                      {dependency}
                    </MonoText>
                  ) : (
                    <MonoText>{dependency}</MonoText>
                  )}
                </Td>
                {showImportType && <Td>{isAsync ? "yes" : null}</Td>}
              </Tr>
            ))}
          </React.Fragment>
        ))}
      </Tbody>
    </Table>
  );
}
