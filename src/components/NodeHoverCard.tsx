import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import * as React from "react";

const CARD_WIDTH = 280;
const VIEWPORT_PAD = 10;

export function NodeHoverCard({
  nodeId,
  screenX,
  screenY,
  inCount,
  outCount,
  onCycle,
  importsPreview,
  importedByPreview,
}: {
  nodeId: string;
  screenX: number;
  screenY: number;
  inCount: number;
  outCount: number;
  onCycle?: boolean;
  importsPreview: string[];
  importedByPreview: string[];
}) {
  // Smart positioning: prefer below-right, flip if near edges.
  const [pos, setPos] = React.useState({ left: screenX + 16, top: screenY + 16 });
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let left = screenX + 16;
    let top = screenY + 16;
    if (left + rect.width + VIEWPORT_PAD > winW) left = screenX - rect.width - 16;
    if (top + rect.height + VIEWPORT_PAD > winH) top = screenY - rect.height - 16;
    setPos({ left: Math.max(VIEWPORT_PAD, left), top: Math.max(VIEWPORT_PAD, top) });
  }, [screenX, screenY, nodeId]);

  return (
    <Box
      ref={ref}
      position="fixed"
      left={pos.left}
      top={pos.top}
      zIndex={900}
      bg="white"
      shadow="lg"
      borderRadius="md"
      border="1px solid"
      borderColor="gray.200"
      p={2}
      width={CARD_WIDTH}
      pointerEvents="none"
      fontSize="xs"
    >
      <VStack alignItems="stretch" spacing={1}>
        <Text fontFamily="mono" wordBreak="break-word" fontSize="xs" fontWeight="semibold">
          {nodeId.length > 60 ? "…" + nodeId.slice(-59) : nodeId}
        </Text>
        <HStack spacing={1}>
          <Badge fontSize="0.65em" colorScheme="purple">in:{inCount}</Badge>
          <Badge fontSize="0.65em" colorScheme="teal">out:{outCount}</Badge>
          {onCycle && <Badge fontSize="0.65em" colorScheme="red">on cycle</Badge>}
        </HStack>
        {importedByPreview.length > 0 && (
          <VStack alignItems="flex-start" spacing={0}>
            <Text fontSize="0.65em" color="gray.500" textTransform="uppercase" letterSpacing="wider">
              Imported by
            </Text>
            {importedByPreview.slice(0, 3).map((p) => (
              <Text key={p} fontFamily="mono" fontSize="xs" color="gray.700" noOfLines={1}>
                {p}
              </Text>
            ))}
            {importedByPreview.length > 3 && (
              <Text fontSize="xs" color="gray.400">
                +{importedByPreview.length - 3} more
              </Text>
            )}
          </VStack>
        )}
        {importsPreview.length > 0 && (
          <VStack alignItems="flex-start" spacing={0}>
            <Text fontSize="0.65em" color="gray.500" textTransform="uppercase" letterSpacing="wider">
              Imports
            </Text>
            {importsPreview.slice(0, 3).map((p) => (
              <Text key={p} fontFamily="mono" fontSize="xs" color="gray.700" noOfLines={1}>
                {p}
              </Text>
            ))}
            {importsPreview.length > 3 && (
              <Text fontSize="xs" color="gray.400">
                +{importsPreview.length - 3} more
              </Text>
            )}
          </VStack>
        )}
        <Text fontSize="0.65em" color="gray.400">click to inspect</Text>
      </VStack>
    </Box>
  );
}
