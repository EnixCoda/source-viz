import * as React from "react";
import { safeRegExp } from "../../utils/general";
import { UseInputViewConfig, useInputView } from "./useInputView";

export function useRegExpInputView(config: UseInputViewConfig = {}) {
  const [isInvalid, setIsInvalid] = React.useState(() => getRegExp(config.defaultValue || "") === false);

  const [view, inputValue, setInputValue] = useInputView({
    errorMessage: isInvalid && "Invalid RegExp",
    ...config,
    inputProps: { isInvalid, placeholder: "Regular Expression", ...config.inputProps },
  });
  const regExp = React.useMemo(() => getRegExp(inputValue), [inputValue]);
  const [lastValidRegExp, setLastValidRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    // preserve value on regExp become invalid
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (regExp !== false) setLastValidRegExp(regExp);
  }, [regExp]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsInvalid(regExp === false);
  }, [regExp]);

  const reset = React.useCallback(() => setInputValue(""), [setInputValue]);

  return [view, lastValidRegExp, inputValue, reset, setInputValue] as const;
}

function getRegExp(input: string) {
  return safeRegExp(input, "i");
}
