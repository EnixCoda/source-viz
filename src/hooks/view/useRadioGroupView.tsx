import { FormControl, FormHelperText, FormLabel, HStack, Radio, RadioGroup, RadioGroupProps } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useRadioGroupView<T extends string>(
  label: React.ReactNode,
  options: { label: React.ReactNode; value: T | null }[],
  defaultValue: T,
  { helperText, radioGroupProps }: { helperText?: React.ReactNode; radioGroupProps?: Partial<RadioGroupProps> } = {},
) {
  return useView<T>(
    defaultValue,
    (value, setState) => (
      <FormControl>
        <FormLabel>{label}</FormLabel>
        <RadioGroup value={value} onChange={(newValue) => setState(newValue as typeof value)} {...radioGroupProps}>
          <HStack spacing={5}>
            {options.map(({ label, value }) => (
              <Radio key={value} value={value || ""}>
                {label}
              </Radio>
            ))}
          </HStack>
        </RadioGroup>
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    ),
    [label, options, radioGroupProps],
  );
}
