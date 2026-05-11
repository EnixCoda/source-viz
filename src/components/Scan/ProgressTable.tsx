import { Box, Table, Tbody, Td, Th, Thead, Tooltip, Tr } from "@chakra-ui/react";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MonoText } from "../MonoText";
import { ScanProgress } from "./useScanningStateReducer";

const ROW_HEIGHT = 33;

export const ProgressTable = React.memo(function ProgressTable({ progress }: { progress: ScanProgress[] }) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: progress.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <Box ref={parentRef} overflow="auto" height="100%">
      <Table size="sm">
        <Thead position="sticky" top={0} bg="white" zIndex={1}>
          <Tr>
            <Th>File</Th>
            <Th width="0%" whiteSpace="nowrap">
              Status
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr style={{ height: virtualizer.getTotalSize() }}>
            <Td colSpan={2} p={0} border="none" />
          </Tr>
        </Tbody>
      </Table>
      <Box position="relative" mt={`-${virtualizer.getTotalSize()}px`}>
        <Box style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const [file, parsed, error] = progress[vItem.index];
            return (
              <Box
                key={vItem.index}
                position="absolute"
                top={0}
                left={0}
                width="100%"
                display="flex"
                alignItems="center"
                px={4}
                gap={4}
                fontSize="sm"
                borderBottom="1px solid"
                borderColor="gray.100"
                style={{
                  height: vItem.size,
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                <Box flex={1} minW={0} isTruncated>
                  <MonoText>{file}</MonoText>
                </Box>
                <Box width="auto" whiteSpace="nowrap">
                  {error ||
                    (parsed ? (
                      <Tooltip label="Parsed successfully">✅</Tooltip>
                    ) : (
                      <Tooltip label="Pending parsing">⏳</Tooltip>
                    ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
});
