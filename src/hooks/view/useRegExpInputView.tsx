import { FormErrorMessage, Input } from "@chakra-ui/react";
import * as React from "react";
import { safeRegExp } from "../../utils/general";
import { useRender } from "../useRender";

export function useRegExpInputView(defaultValue: string = "") {
  const [inputValue, setInputValue] = React.useState(defaultValue);
  const regExp = React.useMemo(() => safeRegExp(inputValue, "i"), [inputValue]);
  const [lastValidRegExp, setLastValidRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    // preserve value on regExp become invalid
    if (regExp !== false) setLastValidRegExp(regExp);
  }, [regExp]);

  const inputView = useRender(
    (state, setState, isInvalid) => (
      <Input
        isInvalid={isInvalid}
        placeholder="Regular Expression"
        value={state}
        onChange={(e) => setState(e.target.value)}
      />
    ),
    [inputValue, setInputValue, regExp === false] as const
  );

  const view = React.useMemo(
    () => (
      <>
        {inputView}
        {regExp === false && <FormErrorMessage>Invalid RegExp</FormErrorMessage>}
      </>
    ),
    [inputView, regExp]
  );

  return [view, lastValidRegExp, inputValue] as const;
}
