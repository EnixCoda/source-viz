import { VStack } from "@chakra-ui/react";
import * as React from "react";
import { useRegExpInputView } from "../hooks/view/useRegExpInputView";
import { NodeList, NodeListProps } from "./NodeList";

export function NodesFilter({ nodes, ...rest }: NodeListProps) {
  const [view, regExp] = useRegExpInputView({ inputProps: { placeholder: "Filter nodes below by RegExp" } });
  const filteredNodes = React.useMemo(() => nodes?.filter((id) => !regExp || id.match(regExp)), [nodes, regExp]);

  return (
    <VStack maxWidth="100%" alignItems="flex-start">
      {view}
      <NodeList {...rest} nodes={filteredNodes} />
    </VStack>
  );
}
