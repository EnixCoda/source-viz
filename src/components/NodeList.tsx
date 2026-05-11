import { Badge, Box, List, ListItem, ListProps, Text } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { DependencyKind } from "../services/serializers";
import { compareStrings } from "../utils/general";
import { NodeItem, NodeItemProps } from "./NodeItem";

export type NodeListProps = {
  nodes?: string[];
  kindMap?: Map<string, DependencyKind>;
  mapProps?: (node: string) => Omit<NodeItemProps, "label">;
  listProps?: ListProps;
  order?: Order;
};

const ITEM_HEIGHT = 28;

export function NodeList({ nodes, kindMap, mapProps, listProps, order }: NodeListProps) {
  const sorted = useMemo(() => {
    if (!nodes) return;
    return [...nodes].sort((a, b) => compareStrings(a, b, order));
  }, [nodes, order]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  return sorted?.length ? (
    <Box
      ref={parentRef}
      width="100%"
      maxHeight={360}
      overflow="auto"
      {...listProps}
    >
      <List
        width="100%"
        display="inline-flex"
        flexDirection="column"
        padding={2}
        gap={0}
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((vItem) => {
          const record = sorted[vItem.index];
          const kind = kindMap?.get(record);
          const badge = kind === "external"
            ? <Badge colorScheme="gray" fontSize="0.6em" ml={1}>ext</Badge>
            : kind === "unresolved"
            ? <Badge colorScheme="orange" fontSize="0.6em" ml={1}>?</Badge>
            : null;
          return (
            <ListItem
              key={vItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: vItem.size,
                transform: `translateY(${vItem.start}px)`,
              }}
            >
              <NodeItem label={record} badge={badge} {...mapProps?.(record)} />
            </ListItem>
          );
        })}
      </List>
    </Box>
  ) : (
    <Text color="grey">No data</Text>
  );
}
