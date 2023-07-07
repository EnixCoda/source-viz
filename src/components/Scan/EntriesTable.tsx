import { Table, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import * as React from "react";
import { DependencyEntry } from "../../services/serializers";
import { MonoText } from "../MonoText";

export function EntriesTable({ entries }: { entries: DependencyEntry[] }) {
  return (
    <Table size="sm">
      <Thead>
        <Tr>
          <Th>File</Th>
          <Th>Dependencies</Th>
          <Th width="0%" whiteSpace="nowrap">
            is async import
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {entries.map(([file, dependencies]) => (
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
                <Td>{isAsync ? "async" : null}</Td>
              </Tr>
            ))}
          </React.Fragment>
        ))}
      </Tbody>
    </Table>
  );
}
