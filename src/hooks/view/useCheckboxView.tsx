import { Checkbox, CheckboxProps, FormControl, FormHelperText } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useCheckboxView(
  label: React.ReactNode,
  defaultValue: boolean,
  { checkboxProps, helperText }: { checkboxProps?: CheckboxProps; helperText?: React.ReactNode } = {}
) {
  return useView(
    defaultValue,
    (checked, setChecked) => (
      <FormControl>
        <Checkbox isChecked={checked} onChange={(e) => setChecked(e.target.checked)} {...checkboxProps}>
          {label}
        </Checkbox>
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    ),
    [label, checkboxProps]
  );
}
