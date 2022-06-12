import { List } from "@chakra-ui/react";
import * as React from "react";
import { NodeInView } from "./NodeInView";

export function NodeList<T>({
  data,
  mapProps,
}: {
  data?: T[];
  mapProps: (record: T) => React.ComponentProps<typeof NodeInView>;
}) {
  return (
    <List paddingLeft={4} maxHeight={360} overflow="auto">
      {data?.length ? data.map((record, i) => <NodeInView key={i} {...mapProps(record)} />) : <>No data</>}
    </List>
  );
}
