import * as React from "react";
import { useView } from "./useView";

export function useCheckboxView(label: React.ReactNode, defaultValue: boolean) {
  return useView(
    defaultValue,
    (checked, setChecked) => (
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        {label}
      </label>
    ),
    [label]
  );
}
