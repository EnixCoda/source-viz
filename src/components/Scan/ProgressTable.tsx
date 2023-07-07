import { Table, Tbody, Td, Th, Thead, Tooltip, Tr } from "@chakra-ui/react";
import * as React from "react";
import { MonoText } from "../MonoText";
import { ScanProgress } from "./useScanningStateReducer";

export const ProgressTable = React.memo(function ProgressTable({ progress }: { progress: ScanProgress[] }) {
  return (
    <Table size="sm" height="100%">
      <Thead>
        <Tr>
          <Th>File</Th>
          <Th width="0%" whiteSpace="nowrap">
            Status
          </Th>
          <Th width="0%" whiteSpace="nowrap">
            Action
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {progress.map(([file, parsed, error], index) => (
          <Tr key={index}>
            <Td>
              <MonoText>{file}</MonoText>
            </Td>
            <Td width="0%">
              {error ||
                (parsed ? (
                  <Tooltip label="Parsed successfully">✅</Tooltip>
                ) : (
                  <Tooltip label="Pending parsing">⏳</Tooltip>
                ))}
            </Td>
            <Td width="0%">{/* TODO: setup vscode */}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
});
