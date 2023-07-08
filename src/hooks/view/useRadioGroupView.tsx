import { HStack, Radio, RadioGroup, RadioGroupProps } from "@chakra-ui/react";
import * as React from "react";
import { FormControlView, UseFormControlConfig } from "./FormControlView";
import { useView } from "./useView";

export function useRadioGroupView<T extends string>(
  label: React.ReactNode,
  options: { label: React.ReactNode; value: T }[],
  { defaultValue, inputProps, ...formControlViewProps }: UseFormControlConfig<T, RadioGroupProps> = {},
) {
  return useView<T | undefined>(defaultValue, (value, setState) => (
    <FormControlView label={label} {...formControlViewProps}>
      <RadioGroup value={value} onChange={(newValue) => setState(newValue as typeof value)} {...inputProps}>
        <HStack spacing={5}>
          {options.map(({ label, value }) => (
            <Radio key={value} value={value || ""}>
              {label}
            </Radio>
          ))}
        </HStack>
      </RadioGroup>
    </FormControlView>
  ));
}
