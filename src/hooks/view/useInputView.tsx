import { Input, InputProps } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useInputView(defaultValue: string = "", inputProps?: InputProps) {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <Input {...inputProps} value={state} onChange={(e) => setState(e.target.value)} />
  ));
  const view = React.useMemo(() => <>{inputView}</>, [inputView]);

  return [view, inputValue] as const;
}
