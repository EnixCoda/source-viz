import { Table, TableProps, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import * as React from "react";
import { DependencyEntry } from "../../services/serializers";
import { Order } from "../../types";
import { compareStrings } from "../../utils/general";
import { MonoText } from "../MonoText";

export function EntriesTable({
  entries,
  showImportType,
  tableProps,
  order,
}: {
  entries: DependencyEntry[];
  showImportType?: boolean;
  tableProps?: TableProps;
  order?: Order;
}) {
  const ordered = React.useMemo(
    () =>
      entries
        .map(
          ([file, dependencies]) =>
            [
              file,
              dependencies.map((_) => [..._] as typeof _).sort(([a], [b]) => compareStrings(a, b, order)),
            ] satisfies (typeof entries)[number],
        )
        .sort(([a], [b]) => compareStrings(a, b, order)),
    [entries, order],
  );

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
        {ordered.map(([file, dependencies]) => (
          <React.Fragment key={file}>
            {dependencies.map(([dependency, isAsync], index, arr) => (
              <Tr key={dependency} verticalAlign="baseline">
                {index === 0 ? (
                  <Td rowSpan={arr.length}>
                    <MonoText>{file}</MonoText>
                  </Td>
                ) : null}
                <Td>
                  <MonoText>{dependency}</MonoText>
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
