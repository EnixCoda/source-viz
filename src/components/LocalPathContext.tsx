import * as React from "react";
import { createContext, useMemo, useState } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const LocalPathContext = createContext<ReactState<string | null> | null>(null);

export function LocalPathContextProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <LocalPathContext.Provider value={useMemo(() => ({ value, setValue }), [value, setValue])}>
      {children}
    </LocalPathContext.Provider>
  );
}
