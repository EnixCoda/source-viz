import { Badge, Box, HStack, IconButton, Text, Tooltip, VStack } from "@chakra-ui/react";
import { CopyIcon } from "@chakra-ui/icons";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MarqueeText } from "./MarqueeText";
import { SuggestedCut } from "../utils/graphData";

const ROW_HEIGHT = 44;

export function SuggestedCuts({
  cuts,
  cycles,
  onHighlightEdge,
  onClearHighlight,
  onFocusNode,
}: {
  cuts: SuggestedCut[];
  cycles: string[][];
  onHighlightEdge: (source: string, target: string) => void;
  onClearHighlight: () => void;
  onFocusNode: (id: string) => void;
}) {
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: cuts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (expandedIdx === i ? ROW_HEIGHT + Math.min(120, (cuts[i].cycleIndices.length * 16)) : ROW_HEIGHT),
    overscan: 8,
    getItemKey: (i) => `${cuts[i].source}->${cuts[i].target}`,
  });

  React.useEffect(() => {
    virtualizer.measure();
  }, [expandedIdx, virtualizer]);

  if (cuts.length === 0) {
    return <Text fontSize="sm" color="gray.400">No suggested cuts.</Text>;
  }

  return (
    <Box ref={parentRef} flex={1} minH={0} overflowY="auto" onMouseLeave={onClearHighlight}>
      <Box height={`${virtualizer.getTotalSize()}px`} position="relative">
        {virtualizer.getVirtualItems().map((vItem) => {
          const cut = cuts[vItem.index];
          const expanded = expandedIdx === vItem.index;
          return (
            <Box
              key={vItem.key}
              position="absolute"
              top={0}
              left={0}
              right={0}
              transform={`translateY(${vItem.start}px)`}
              borderBottom="1px solid"
              borderColor="gray.100"
              ref={virtualizer.measureElement}
              data-index={vItem.index}
            >
              <HStack
                px={2}
                py={1}
                cursor="pointer"
                _hover={{ bg: "orange.50" }}
                onMouseEnter={() => onHighlightEdge(cut.source, cut.target)}
                onClick={() => setExpandedIdx(expanded ? null : vItem.index)}
                spacing={1}
              >
                <VStack alignItems="stretch" spacing={0} flex={1} minW={0}>
                  <MarqueeText fontFamily="mono" fontSize="xs">
                    {cut.source}
                  </MarqueeText>
                  <MarqueeText fontFamily="mono" fontSize="xs">
                    {`→ ${cut.target}`}
                  </MarqueeText>
                </VStack>
                <Badge colorScheme="orange" fontSize="0.65em" flexShrink={0}>
                  breaks {cut.cycleCount}
                </Badge>
                <Tooltip label="Copy edge" hasArrow openDelay={400}>
                  <IconButton
                    aria-label="Copy"
                    icon={<CopyIcon />}
                    size="xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${cut.source} -> ${cut.target}`).catch(() => {});
                    }}
                  />
                </Tooltip>
              </HStack>
              {expanded && (
                <VStack alignItems="stretch" spacing={0} px={4} pb={2} bg="orange.50" maxHeight="120px" overflowY="auto">
                  <Text fontSize="0.65em" color="gray.600" textTransform="uppercase">
                    Participates in cycles
                  </Text>
                  {cut.cycleIndices.map((cIdx) => {
                    const cycle = cycles[cIdx];
                    if (!cycle) return null;
                    return (
                      <HStack key={cIdx} spacing={1} py={0.5}>
                        <Text fontSize="xs" color="gray.500" flexShrink={0}>#{cIdx + 1}</Text>
                        <MarqueeText fontFamily="mono" fontSize="xs" flex={1} minW={0}>
                          {cycle.map((n, i) => (i === 0 ? n : ` → ${n}`)).join("")}
                        </MarqueeText>
                        <IconButton
                          aria-label="Focus first node"
                          icon={<CopyIcon />}
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusNode(cycle[0]);
                          }}
                          title="Focus first node"
                        />
                      </HStack>
                    );
                  })}
                </VStack>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
