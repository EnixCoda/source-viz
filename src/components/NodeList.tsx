import { List, ListItem, ListProps, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { Order } from "../types";
import { compareStrings } from "../utils/general";
import { NodeItem, NodeItemProps } from "./NodeItem";

export type NodeListProps = {
  nodes?: string[];
  mapProps?: (node: string) => Omit<NodeItemProps, "label">;
  listProps?: ListProps;
  order?: Order;
};

export function NodeList({ nodes, mapProps, listProps, order }: NodeListProps) {
  const sorted = useMemo(() => {
    if (!nodes) return;
    return [...nodes].sort((a, b) => compareStrings(a, b, order));
  }, [nodes, order]);

  return sorted?.length ? (
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
      {sorted.map((record, i) => (
        <ListItem key={i}>
          <NodeItem label={record} {...mapProps?.(record)} />
        </ListItem>
      ))}
    </List>
  ) : (
    <Text color="grey">No data</Text>
  );
}
