import { Badge, Box, BoxProps, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { List } from "react-window";
import { DependencyKind } from "../services/serializers";
import { compareStrings } from "../utils/general";
import { NodeItem, NodeItemProps } from "./NodeItem";

export type NodeListProps = {
  nodes?: string[];
  kindMap?: Map<string, DependencyKind>;
  mapProps?: (node: string) => Omit<NodeItemProps, "label">;
  listProps?: BoxProps;
  order?: Order;
  maxHeight?: number;
  rowHeight?: number;
};

const DEFAULT_MAX_HEIGHT = 360;
const DEFAULT_ROW_HEIGHT = 26;
const VIRTUALIZE_THRESHOLD = 30;

function renderBadge(kind: DependencyKind | undefined) {
  if (kind === "external") return <Badge colorScheme="gray" fontSize="0.6em" ml={1}>ext</Badge>;
  if (kind === "unresolved") return <Badge colorScheme="orange" fontSize="0.6em" ml={1}>?</Badge>;
  return null;
}

type RowProps = {
  sorted: string[];
  kindMap?: Map<string, DependencyKind>;
  mapProps?: NodeListProps["mapProps"];
};

export function NodeList({
  nodes,
  kindMap,
  mapProps,
  listProps,
  order,
  maxHeight = DEFAULT_MAX_HEIGHT,
  rowHeight = DEFAULT_ROW_HEIGHT,
}: NodeListProps) {
  const sorted = useMemo(() => {
    if (!nodes) return;
    return [...nodes].sort((a, b) => compareStrings(a, b, order));
  }, [nodes, order]);

  if (!sorted?.length) {
    return <Text color="grey" fontSize="sm">No data</Text>;
  }

  if (sorted.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <Box
        width="100%"
        display="flex"
        flexDirection="column"
        py={1}
        maxHeight={maxHeight}
        overflowY="auto"
        gap={0.5}
        {...listProps}
      >
        {sorted.map((record, i) => (
          <Box key={i} role="listitem">
            <NodeItem label={record} badge={renderBadge(kindMap?.get(record))} {...mapProps?.(record)} />
          </Box>
        ))}
      </Box>
    );
  }

  const listHeight = Math.min(maxHeight, sorted.length * rowHeight + 4);
  const rowProps: RowProps = { sorted, kindMap, mapProps };

  return (
    <Box width="100%" {...listProps}>
      <List<RowProps>
        rowCount={sorted.length}
        rowHeight={rowHeight}
        defaultHeight={listHeight}
        style={{ height: listHeight, maxHeight }}
        overscanCount={6}
        rowProps={rowProps}
        rowComponent={NodeListRow}
      />
    </Box>
  );
}

function NodeListRow({
  index,
  style,
  sorted,
  kindMap,
  mapProps,
}: { index: number; style: React.CSSProperties } & RowProps) {
  const record = sorted[index];
  return (
    <div style={style} role="listitem">
      <NodeItem label={record} badge={renderBadge(kindMap?.get(record))} {...mapProps?.(record)} />
    </div>
  );
}
