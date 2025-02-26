import * as React from "react";

export const useForgetableMemo = <R,>(fn: () => R, deps: any[]) => {
  const [key, setKey] = React.useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memo = React.useMemo(fn, [key, ...deps]);
  const forget = React.useCallback(() => setKey((k) => k + 1), []);
  return [memo, forget] as const;
};
