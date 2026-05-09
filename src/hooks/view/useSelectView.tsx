import { Select, SelectProps } from "@chakra-ui/react";
import * as React from "react";
import { FormControlView, UseFormControlConfig } from "./FormControlView";
import { useView } from "./useView";

export function useSelectView<T extends string>(
  { defaultValue, inputProps, ...formControlViewProps }: UseFormControlConfig<T | undefined, SelectProps> = {},
  options: { label: React.ReactNode; value: T | null; disabled?: boolean }[],
) {
  return useView<T | undefined>(defaultValue, (value, setState) => (
    <FormControlView {...formControlViewProps}>
      <Select value={value} onChange={(e) => setState(e.target.value as typeof value)} {...inputProps}>
        {options.map(({ label, value, disabled }) => (
          <option key={value} value={value || ""} disabled={disabled}>
            {label}
          </option>
        ))}
      </Select>
    </FormControlView>
  ));
}
