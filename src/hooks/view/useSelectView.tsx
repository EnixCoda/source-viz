import { FormControl, FormLabel, Select } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useSelectView<T extends string>(
  label: React.ReactNode,
  options: { label: React.ReactNode; value: T }[],
  defaultValue: T
) {
  return useView<T>(
    defaultValue,
    (value, setState) => (
      <FormControl>
        <FormLabel>{label}</FormLabel>
        <Select value={value} onChange={(e) => setState(e.target.value as typeof value)}>
          {options.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>
    ),
    [label, options]
  );
}
