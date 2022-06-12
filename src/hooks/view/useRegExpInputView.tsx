import * as React from "react";
import { invalidRegExp, safeRegExp } from "../../utils/general";
import { useView } from "./useView";

export function useRegExpInputView(defaultValue: string = "") {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <input placeholder="RegEx supported" value={state} onChange={(e) => setState(e.target.value)} />
  ));
  const [regExp, setRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    const r = safeRegExp(inputValue, "i");
    if (r) setRegExp(r);
  }, [inputValue]);
  const view = React.useMemo(
    () => (
      <>
        {inputView}
        {regExp === invalidRegExp ? "Invalid RegExp" : null}
      </>
    ),
    [inputView, inputValue, regExp]
  );

  return [view, regExp, inputValue] as const;
}
