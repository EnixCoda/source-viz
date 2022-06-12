import { Checkbox, FormControl } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useCheckboxView(label: React.ReactNode, defaultValue: boolean) {
  return useView(
    defaultValue,
    (checked, setChecked) => (
      <FormControl>
        <Checkbox isChecked={checked} onChange={(e) => setChecked(e.target.checked)}>
          {label}
        </Checkbox>
      </FormControl>
    ),
    [label]
  );
}
