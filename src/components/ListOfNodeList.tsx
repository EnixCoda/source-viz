import { Box, BoxProps, ListItem, OrderedList, Text } from "@chakra-ui/react";
import { NodeList, NodeListProps } from "./NodeList";

export function ListOfNodeList({
  lists,
  getProps,
  containerProps,
}: {
  lists?: string[][];
  getProps?: (index: number) => NodeListProps;
  containerProps?: BoxProps;
}) {
  return lists?.length ? (
    <Box maxHeight={360} overflow="auto" paddingLeft={4} {...containerProps}>
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
