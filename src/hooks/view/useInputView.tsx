import {
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  InputProps,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputProps,
  NumberInputStepper,
} from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useInputView(
  defaultValue: string = "",
  {
    label,
    inputProps,
    helperText,
  }: {
    inputProps?: InputProps;
    label?: React.ReactNode;
    helperText?: React.ReactNode;
  } = {}
) {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <Input {...inputProps} value={state} onChange={(e) => setState(e.target.value)} />
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  ));
  const view = React.useMemo(() => <>{inputView}</>, [inputView]);

  return [view, inputValue] as const;
}

export function useNumberInputView(
  defaultValue: number | null,
  {
    label,
    inputProps,
    helperText,
  }: {
    inputProps?: NumberInputProps;
    label?: React.ReactNode;
    helperText?: React.ReactNode;
  } = {}
) {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <NumberInput
        {...inputProps}
        value={state || undefined}
        onChange={(valueString, valueNumber) => setState(valueNumber)}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  ));

  return [inputView, inputValue] as const;
}
