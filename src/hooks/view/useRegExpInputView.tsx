import { FormErrorMessage, Input } from "@chakra-ui/react";
import * as React from "react";
import { safeRegExp } from "../../utils/general";

export function useRegExpInputView(defaultValue: string = "") {
  const [inputValue, setInputValue] = React.useState(defaultValue);
  const regExp = React.useMemo(() => safeRegExp(inputValue, "i"), [inputValue]);
  const [lastValidRegExp, setLastValidRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    // preserve value on regExp become invalid
    if (regExp !== false) setLastValidRegExp(regExp);
  }, [regExp]);

  const inputView = React.useMemo(
    () => (
      <Input
        placeholder="Regular Expression"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        isInvalid={regExp === false}
      />
    ),
    [inputValue, setInputValue, regExp === false]
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
