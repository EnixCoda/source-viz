import { Badge, Box, BoxProps, Text } from "@chakra-ui/react";
import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DependencyKind } from "../services/serializers";
import { compareStrings } from "../utils/general";
import { NodeItem, NodeItemProps } from "./NodeItem";

export type NodeListProps = {
  nodes?: string[];
  kindMap?: Map<string, DependencyKind>;
  mapProps?: (node: string) => Omit<NodeItemProps, "label">;
  listProps?: BoxProps;
  order?: Order;
  minHeight?: number;
  maxHeight?: number;
  rowHeight?: number;
  /** When true, the list grows to fill its flex container instead of capping at maxHeight */
  fillContainer?: boolean;
};

const DEFAULT_MAX_HEIGHT = 360;
const DEFAULT_ROW_HEIGHT = 26;

function renderBadge(kind: DependencyKind | undefined) {
  if (kind === "external") return <Badge colorScheme="gray" fontSize="0.6em" ml={1}>ext</Badge>;
  if (kind === "unresolved") return <Badge colorScheme="orange" fontSize="0.6em" ml={1}>?</Badge>;
  return null;
}

export function NodeList({
  nodes,
  kindMap,
  mapProps,
  listProps,
  order,
  minHeight,
  maxHeight = DEFAULT_MAX_HEIGHT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  fillContainer = false,
}: NodeListProps) {
  const sorted = useMemo(() => {
    if (!nodes) return [] as string[];
    return [...nodes].sort((a, b) => compareStrings(a, b, order));
  }, [nodes, order]);

  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  if (!sorted.length) {
    return <Text color="grey" fontSize="sm">No data</Text>;
  }

  return (
    <Box
      ref={parentRef}
      width="100%"
      overflowY="auto"
      minHeight={minHeight}
      {...(fillContainer ? { flex: 1 } : { maxHeight })}
      {...listProps}
    >
      <Box height={`${virtualizer.getTotalSize()}px`} position="relative">
        {virtualizer.getVirtualItems().map((vItem) => {
          const record = sorted[vItem.index];
          return (
            <Box
              key={vItem.key}
              role="listitem"
              position="absolute"
              top={0}
              left={0}
              right={0}
              transform={`translateY(${vItem.start}px)`}
              height={`${rowHeight}px`}
              display="flex"
              alignItems="center"
            >
              <NodeItem
                label={record}
                badge={renderBadge(kindMap?.get(record))}
                {...mapProps?.(record)}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
