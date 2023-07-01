import { Box } from "@chakra-ui/react";
import * as React from "react";
import { useRegExpInputView } from "../hooks/view/useRegExpInputView";
import { NodeList, NodeListProps } from "./NodeList";

export function NodesFilter({ nodes, ...rest }: NodeListProps) {
  const [view, regExp] = useRegExpInputView();
  const filteredNodes = React.useMemo(() => nodes?.filter((id) => !regExp || id.match(regExp)), [nodes, regExp]);

  return (
    <Box>
      {view}
      <NodeList {...rest} nodes={filteredNodes} />
    </Box>
  );
}
