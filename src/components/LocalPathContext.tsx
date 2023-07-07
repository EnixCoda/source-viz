import { createContext, useMemo, useState } from "react";
import { ReactState } from "./type";

export const LocalPathContext = createContext<ReactState<string> | undefined>(undefined);

export function LocalPathContextProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <LocalPathContext.Provider value={useMemo(() => ({ value, setValue }), [value, setValue])}>
      {children}
    </LocalPathContext.Provider>
  );
}
