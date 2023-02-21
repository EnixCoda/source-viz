import * as React from "react";

export function useRender<T extends any[] | readonly any[]>(renderer: (...states: T) => React.ReactNode, states: T) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => renderer(...states), [renderer, ...states]);
}
