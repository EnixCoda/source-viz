import { List, ListItem, ListProps, Text } from "@chakra-ui/react";
import { NodeItem, NodeItemProps } from "./NodeItem";

export type NodeListProps = {
  nodes?: string[];
  mapProps?: (node: string) => Omit<NodeItemProps, "label">;
  listProps?: ListProps;
};

export function NodeList({ nodes, mapProps, listProps }: NodeListProps) {
  return nodes?.length ? (
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
      {nodes.map((record, i) => (
        <ListItem key={i}>
          <NodeItem label={record} {...mapProps?.(record)} />
        </ListItem>
      ))}
    </List>
  ) : (
    <Text color="grey">No data</Text>
  );
}
