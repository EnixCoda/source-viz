import { Badge, List, ListItem, ListProps, Text } from "@chakra-ui/react";
import { useMemo } from "react";
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

export function NodeList({ nodes, kindMap, mapProps, listProps, order }: NodeListProps) {
  const sorted = useMemo(() => {
    if (!nodes) return;
    return [...nodes].sort((a, b) => compareStrings(a, b, order));
  }, [nodes, order]);

  const MAX_VISIBLE = 200;
  const displayed = sorted && sorted.length > MAX_VISIBLE ? sorted.slice(0, MAX_VISIBLE) : sorted;
  const overflow = sorted ? sorted.length - MAX_VISIBLE : 0;

  return displayed?.length ? (
    <List
      width="100%"
      display="inline-flex"
      flexDirection="column"
      padding={2}
      maxHeight={360}
      overflow="auto"
      gap={1}
      {...listProps}
    >
      {displayed.map((record, i) => {
        const kind = kindMap?.get(record);
        const badge = kind === "external"
          ? <Badge colorScheme="gray" fontSize="0.6em" ml={1}>ext</Badge>
          : kind === "unresolved"
          ? <Badge colorScheme="orange" fontSize="0.6em" ml={1}>?</Badge>
          : null;
        return (
          <ListItem key={i}>
            <NodeItem label={record} badge={badge} {...mapProps?.(record)} />
          </ListItem>
        );
      })}
      {overflow > 0 && (
        <ListItem>
          <Text color="gray.400" fontSize="xs">{overflow} more…</Text>
        </ListItem>
      )}
    </List>
  ) : (
    <Text color="grey">No data</Text>
  );
}
