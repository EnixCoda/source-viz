import { FormErrorMessage, Input, InputProps } from "@chakra-ui/react";
import * as React from "react";
import { safeRegExp } from "../../utils/general";

export function useRegExpInputView(defaultValue: string = "", inputProps?: InputProps) {
  const [inputValue, setInputValue] = React.useState(defaultValue);
  const regExp = React.useMemo(() => safeRegExp(inputValue, "i"), [inputValue]);
  const [lastValidRegExp, setLastValidRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    // preserve value on regExp become invalid
    if (regExp !== false) setLastValidRegExp(regExp);
  }, [regExp]);

  const isInvalid = regExp === false;
  const inputView = React.useMemo(
    () => (
      <Input
        placeholder="Regular Expression"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        isInvalid={isInvalid}
        {...inputProps}
      />
    ),
    [inputValue, setInputValue, isInvalid, inputProps]
  );

  const view = React.useMemo(
    () => (
      <>
        {inputView}
        {isInvalid && <FormErrorMessage>Invalid RegExp</FormErrorMessage>}
      </>
    ),
    [inputView, isInvalid]
  );

  return [view, lastValidRegExp, inputValue] as const;
}
