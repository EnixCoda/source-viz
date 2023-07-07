import { Box, Heading, Table, Tbody, Td, Th, Thead, Tr, VStack } from "@chakra-ui/react";
import * as React from "react";
import { DependencyEntry } from "../../services/serializers";

export function EntriesTable({ entries }: { entries: DependencyEntry[] }) {
  return (
    <VStack alignItems="stretch" minH={0} overflow="auto">
      <Heading as="h3" size="lg">
        Parsed dependency records
      </Heading>
      <Box maxHeight={360} overflowY="auto">
        <Table>
          <Thead>
            <Tr>
              <Th>File</Th>
              <Th>Dependency</Th>
              <Th width="0%" whiteSpace="nowrap">
                is async import
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {entries.map(([file, dependencies]) => (
              <React.Fragment key={file}>
                {dependencies.map(([dependency, isAsync]) => (
                  <Tr key={dependency}>
                    <Td>{file}</Td>
                    <Td>{dependency}</Td>
                    <Td>{isAsync ? "async" : null}</Td>
                  </Tr>
                ))}
              </React.Fragment>
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
}
