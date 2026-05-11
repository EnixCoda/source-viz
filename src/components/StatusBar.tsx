import { Box, Divider, HStack, Text, Tooltip } from "@chakra-ui/react";
import * as React from "react";

export type StatusBarProps = {
  totalFiles: number;
  renderedNodes: number;
  renderedEdges: number;
  cycles: number;
  selected: number;
  graphMode: string;
  asyncCutoff: boolean;
  layoutStale?: boolean;
};

function Stat({ label, value, tooltip }: { label: string; value: React.ReactNode; tooltip?: string }) {
  const content = (
    <HStack spacing={1} fontSize="xs" minW={0}>
      <Text color="gray.500">{label}</Text>
      <Text fontWeight="semibold" color="gray.700">
        {value}
      </Text>
    </HStack>
  );
  return tooltip ? <Tooltip label={tooltip} hasArrow openDelay={300}>{content}</Tooltip> : content;
}

export function StatusBar({
  totalFiles,
  renderedNodes,
  renderedEdges,
  cycles,
  selected,
  graphMode,
  asyncCutoff,
  layoutStale,
}: StatusBarProps) {
  return (
    <Box
      borderTop="1px solid"
      borderColor="gray.200"
      bg="gray.50"
      px={2}
      py={1}
      flexShrink={0}
    >
      <HStack spacing={2} divider={<Divider orientation="vertical" height="12px" />} overflow="hidden">
        <Stat label="files" value={`${renderedNodes}/${totalFiles}`} tooltip="rendered / total" />
        <Stat label="edges" value={renderedEdges} />
        <Stat
          label="cycles"
          value={cycles}
          tooltip={cycles ? `${cycles} cycle${cycles > 1 ? "s" : ""} detected` : "no cycles"}
        />
        <Stat label="selected" value={selected} />
        <Stat label="mode" value={graphMode} />
        {asyncCutoff && <Stat label="async" value="cut" tooltip="Async imports excluded" />}
        {layoutStale && (
          <Text fontSize="xs" color="orange.500" fontWeight="semibold">
            layout stale
          </Text>
        )}
      </HStack>
    </Box>
  );
}
