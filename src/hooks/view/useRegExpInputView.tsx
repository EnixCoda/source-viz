import { FormErrorMessage, Input } from "@chakra-ui/react";
import * as React from "react";
import { safeRegExp } from "../../utils/general";
import { useView } from "./useView";

export function useRegExpInputView(defaultValue: string = "") {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <Input placeholder="Regular Expression" value={state} onChange={(e) => setState(e.target.value)} />
  ));
  const [regExp, setRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    setRegExp(safeRegExp(inputValue, "i"));
  }, [inputValue]);
  const view = React.useMemo(
    () => (
      <>
        {inputView}
        {!regExp && <FormErrorMessage>Invalid RegExp</FormErrorMessage>}
      </>
    ),
    [inputView, inputValue, regExp]
  );

  return [view, regExp, inputValue] as const;
}
