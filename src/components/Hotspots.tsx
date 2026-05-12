import { Badge, Box, ButtonGroup, Button, HStack, Input, Text, VStack } from "@chakra-ui/react";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MarqueeText } from "./MarqueeText";

export type HotspotMode = "fan-in" | "fan-out" | "coupling";

export type HotspotEntry = {
  id: string;
  fanIn: number;
  fanOut: number;
};

const ROW_HEIGHT = 28;

export function Hotspots({
  entries,
  fanInMap,
  fanOutMap,
  onFocus,
  onHover,
  onLeave,
}: {
  entries: string[];
  fanInMap: Map<string, number>;
  fanOutMap: Map<string, number>;
  onFocus: (id: string) => void;
  onHover?: (id: string) => void;
  onLeave?: () => void;
}) {
  const [mode, setMode] = React.useState<HotspotMode>("fan-in");
  const [filter, setFilter] = React.useState("");

  const ranked = React.useMemo(() => {
    const score = (id: string) => {
      const fi = fanInMap.get(id) ?? 0;
      const fo = fanOutMap.get(id) ?? 0;
      if (mode === "fan-in") return fi;
      if (mode === "fan-out") return fo;
      return fi * fo;
    };
    const list: { id: string; score: number; fanIn: number; fanOut: number }[] = [];
    const filterLc = filter.trim().toLowerCase();
    for (const id of entries) {
      if (filterLc && !id.toLowerCase().includes(filterLc)) continue;
      const s = score(id);
      if (s <= 0) continue;
      list.push({ id, score: s, fanIn: fanInMap.get(id) ?? 0, fanOut: fanOutMap.get(id) ?? 0 });
    }
    list.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return list;
  }, [entries, fanInMap, fanOutMap, mode, filter]);

  const max = ranked[0]?.score ?? 1;

  const parentRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: ranked.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <VStack alignItems="stretch" spacing={2} flex={1} minH={0}>
      <ButtonGroup size="xs" isAttached variant="outline">
        <Button onClick={() => setMode("fan-in")} colorScheme={mode === "fan-in" ? "blue" : undefined}>
          Most imported
        </Button>
        <Button onClick={() => setMode("fan-out")} colorScheme={mode === "fan-out" ? "blue" : undefined}>
          Most importing
        </Button>
        <Button onClick={() => setMode("coupling")} colorScheme={mode === "coupling" ? "blue" : undefined}>
          Coupling
        </Button>
      </ButtonGroup>
      <Input
        size="xs"
        placeholder="Filter by path…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {ranked.length === 0 ? (
        <Text fontSize="sm" color="gray.400">No matches.</Text>
      ) : (
        <Box ref={parentRef} flex={1} minH={0} overflowY="auto" onMouseLeave={onLeave}>
          <Box height={`${virtualizer.getTotalSize()}px`} position="relative">
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = ranked[vItem.index];
              const widthPct = Math.max(2, Math.round((row.score / max) * 100));
              return (
                <Box
                  key={vItem.key}
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  transform={`translateY(${vItem.start}px)`}
                  height={`${ROW_HEIGHT}px`}
                  px={1}
                  display="flex"
                  alignItems="center"
                  cursor="pointer"
                  _hover={{ bg: "blue.50" }}
                  onClick={() => onFocus(row.id)}
                  onMouseEnter={() => onHover?.(row.id)}
                >
                  <Box flex={1} minW={0} position="relative">
                    <Box
                      position="absolute"
                      inset={0}
                      bg="blue.100"
                      width={`${widthPct}%`}
                      borderRadius="sm"
                      opacity={0.5}
                      pointerEvents="none"
                    />
                    <HStack position="relative" spacing={1} px={1}>
                      <MarqueeText fontFamily="mono" fontSize="xs" flex={1} minW={0}>
                        {row.id}
                      </MarqueeText>
                      <Badge fontSize="0.6em" colorScheme="purple" title={`fan-in ${row.fanIn}`}>
                        {row.fanIn}
                      </Badge>
                      <Badge fontSize="0.6em" colorScheme="teal" title={`fan-out ${row.fanOut}`}>
                        {row.fanOut}
                      </Badge>
                    </HStack>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </VStack>
  );
}
