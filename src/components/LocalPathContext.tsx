import { createContext, useMemo, useState } from "react";
import { ReactState } from "../types";

export const LocalPathContext = createContext<ReactState<string | null> | null>(null);

export function LocalPathContextProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <LocalPathContext.Provider value={useMemo(() => ({ value, setValue }), [value, setValue])}>
      {children}
    </LocalPathContext.Provider>
  );
}
