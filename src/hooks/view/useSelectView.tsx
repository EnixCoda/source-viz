import { FormControl, FormHelperText, FormLabel, Select, SelectProps } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useSelectView<T extends string>(
  label: React.ReactNode,
  options: { label: React.ReactNode; value: T | null }[],
  defaultValue: T,
  { helperText, selectProps }: { helperText?: React.ReactNode; selectProps?: SelectProps } = {},
) {
  return useView<T>(
    defaultValue,
    (value, setState) => (
      <FormControl>
        <FormLabel>{label}</FormLabel>
        <Select value={value} onChange={(e) => setState(e.target.value as typeof value)} {...selectProps}>
          {options.map(({ label, value }) => (
            <option key={value} value={value || ""}>
              {label}
            </option>
          ))}
        </Select>
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    ),
    [label, options, selectProps],
  );
}
