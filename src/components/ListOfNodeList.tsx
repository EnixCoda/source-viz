import { Box, ListItem, OrderedList, Text } from "@chakra-ui/react";
import { NodeList, NodeListProps } from "./NodeList";

export function ListOfNodeList({
  lists,
  getProps,
}: {
  lists?: string[][];
  getProps?: (index: number) => NodeListProps;
}) {
  return lists?.length ? (
    <Box maxHeight={360} overflow="auto" paddingLeft={4}>
      <OrderedList>
        {lists.map((nodes, index) => (
          <ListItem key={nodes.join()}>
            <NodeList nodes={nodes} listProps={{ maxHeight: undefined }} {...getProps?.(index)} />
          </ListItem>
        ))}
      </OrderedList>
    </Box>
  ) : (
    <Text color="grey">No data</Text>
  );
}
