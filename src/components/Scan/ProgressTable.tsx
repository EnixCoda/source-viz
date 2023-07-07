import { Box, Heading, Table, Tbody, Td, Th, Thead, Tr, VStack } from "@chakra-ui/react";
import * as React from "react";
import { MonoText } from "../MonoText";
import { ScanProgress } from "./useScanningStateReducer";

export const ProgressTable = React.memo(function ProgressTable({ progress }: { progress: ScanProgress[] }) {
  return (
    <VStack alignItems="stretch" minH={0} overflow="auto">
      <Heading as="h3" size="lg">
        Parsed dependency records
      </Heading>
      <Box maxHeight={360} overflowY="auto">
        <Table size="sm" height="100%">
          <Thead>
            <Tr>
              <Th>File</Th>
              <Th width="0%" whiteSpace="nowrap">
                Parsed or Found Error
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
                <Td width="0%">{error || (parsed ? "✅" : "⏳")}</Td>
                <Td width="0%">{/* TODO: setup vscode */}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
});
