import { List, ListItem, Text } from "@chakra-ui/react";
import * as React from "react";
import { NodeInView } from "./NodeInView";

export function NodeList<T>({
  data,
  mapProps,
}: {
  data?: T[];
  mapProps: (record: T) => React.ComponentProps<typeof NodeInView>;
}) {
  return data?.length ? (
    <List width="100%" display="inline-flex" flexDirection="column" padding={2} maxHeight={360} overflow="auto" gap={1}>
      {data.map((record, i) => (
        <ListItem key={i}>
          <NodeInView {...mapProps(record)} />
        </ListItem>
      ))}
    </List>
  ) : (
    <Text color="grey">No data</Text>
  );
}
