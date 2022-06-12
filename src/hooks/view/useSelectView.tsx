import * as React from "react";
import { useView } from "./useView";

export function useSelectView<T extends string>(
  label: React.ReactNode,
  options: { label: React.ReactNode; value: T; }[],
  defaultValue: T) {
  return useView<T>(
    defaultValue,
    (value, setState) => (
      <label>
        <span>{label}</span>
        <select value={value} onChange={(e) => setState(e.target.value as typeof value)}>
          {options.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    ),
    [label, options]
  );
}
