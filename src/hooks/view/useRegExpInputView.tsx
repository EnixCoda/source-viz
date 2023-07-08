import * as React from "react";
import { safeRegExp } from "../../utils/general";
import { UseInputViewConfig, useInputView } from "./useInputView";

export function useRegExpInputView(config: UseInputViewConfig = {}) {
  const [isInvalid, setIsInvalid] = React.useState(() => getRegExp(config.defaultValue || "") === false);

  const [view, inputValue] = useInputView({
    errorMessage: isInvalid && "Invalid RegExp",
    ...config,
    inputProps: { isInvalid, placeholder: "Regular Expression", ...config.inputProps },
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
