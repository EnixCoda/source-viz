import { Checkbox, CheckboxProps, FormControl } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useCheckboxView(label: React.ReactNode, defaultValue: boolean, extraProps?: CheckboxProps) {
  return useView(
    defaultValue,
    (checked, setChecked) => (
      <FormControl>
        <Checkbox isChecked={checked} onChange={(e) => setChecked(e.target.checked)} {...extraProps}>
          {label}
        </Checkbox>
      </FormControl>
    ),
    [label, extraProps]
  );
}
