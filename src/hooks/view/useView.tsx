import * as React from "react";
import { useRender } from "../useRender";

export function useView<T>(
  defaultValue: T,
  render: (state: T, setState: React.Dispatch<React.SetStateAction<T>>, ...deps: any[]) => React.ReactNode,
  deps: any[] = [],
) {
  const [state, setState] = React.useState(defaultValue);
  const view = useRender(render, [state, setState, ...deps]);
  return [view, state, setState] as const;
}
