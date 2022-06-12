import * as React from "react";

export function useRender<T extends any[]>(renderer: (...states: T) => React.ReactNode, states: T) {
  return React.useMemo(() => renderer(...states), states);
}
