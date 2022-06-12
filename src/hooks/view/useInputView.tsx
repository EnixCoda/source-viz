import * as React from "react";
import { useView } from "./useView";

export function useInputView(defaultValue: string = "", inputProps?: React.InputHTMLAttributes<HTMLInputElement>) {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <input {...inputProps} value={state} onChange={(e) => setState(e.target.value)} />
  ));
  const view = React.useMemo(() => <>{inputView}</>, [inputView, inputValue]);

  return [view, inputValue] as const;
}
