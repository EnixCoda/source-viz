import * as React from "react";
import { safeRegExp } from "../../utils/general";
import { UseInputViewConfig, useInputView } from "./useInputView";

export function useRegExpInputView(defaultValue: string = "", config: UseInputViewConfig = {}) {
  const [isInvalid, setIsInvalid] = React.useState(() => getRegExp(defaultValue) === false);

  const [view, inputValue] = useInputView(defaultValue, {
    errorMessage: isInvalid && "Invalid RegExp",
    ...config,
    inputProps: { ...config.inputProps, isInvalid, placeholder: "Regular Expression" },
  });
  const regExp = React.useMemo(() => getRegExp(inputValue), [inputValue]);
  const [lastValidRegExp, setLastValidRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    // preserve value on regExp become invalid
    if (regExp !== false) setLastValidRegExp(regExp);
  }, [regExp]);

  React.useEffect(() => {
    setIsInvalid(regExp === false);
  }, [regExp]);

  return [view, lastValidRegExp, inputValue] as const;
}

function getRegExp(input: string) {
  return safeRegExp(input, "i");
}
