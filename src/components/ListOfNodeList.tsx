import { Box, BoxProps, ListItem, OrderedList, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { compareStrings } from "../utils/general";
import { NodeList, NodeListProps } from "./NodeList";

export function ListOfNodeList({
  lists,
  getProps,
  containerProps,
  order,
}: {
  lists?: string[][];
  getProps?: (index: number) => NodeListProps;
  containerProps?: BoxProps;
  order?: "asc" | "desc";
}) {
  const sorted = useMemo(() => {
    if (!lists) return;
    return [...lists].sort((a, b) => {
      // compare each items in the list
      const theShorterLength = Math.min(a.length, b.length);
      for (let i = 0; i < theShorterLength; i++) {
        if (a[i] === b[i]) continue;
        return compareStrings(a[i], b[i], order);
      }
      // if all items are equal, compare the length of the list
      if (order === "asc") return a.length - b.length;
      return b.length - a.length;
    });
  }, [lists, order]);

  return sorted?.length ? (
    <Box maxHeight={360} overflow="auto" paddingLeft={4} {...containerProps}>
      <OrderedList>
        {sorted.map((nodes, index) => (
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
