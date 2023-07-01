import {
  FormControl,
  FormErrorMessage,
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

export type UseInputViewConfig = {
  inputProps?: InputProps;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
};

export function useInputView(
  defaultValue: string = "",
  { label, inputProps, helperText, errorMessage }: UseInputViewConfig = {}
) {
  return useView(defaultValue, (state, setState) => (
    <FormControl>
      {label && <FormLabel>{label}</FormLabel>}
      <Input
        isInvalid={inputProps?.isInvalid || !!errorMessage}
        {...inputProps}
        value={state}
        onChange={(e) => setState(e.target.value)}
      />
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
      {errorMessage && <FormErrorMessage>{errorMessage}</FormErrorMessage>}
    </FormControl>
  ));
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
