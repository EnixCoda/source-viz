import * as React from "react";

export function useRender<T extends any[]>(renderer: (...states: T) => React.ReactNode, states: T) {
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return React.useMemo(() => renderer(...states), [renderer, ...states]);
}
