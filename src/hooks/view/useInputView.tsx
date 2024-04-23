import {
  Input,
  InputProps,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputProps,
  NumberInputStepper,
} from "@chakra-ui/react";
import { FormControlView, UseFormControlConfig } from "./FormControlView";
import { useView } from "./useView";

export type UseInputViewConfig = UseFormControlConfig<string, InputProps>;

export function useInputView({ defaultValue = "", inputProps, ...formControlViewProps }: UseInputViewConfig = {}) {
  const isInvalid = inputProps?.isInvalid || !!formControlViewProps?.errorMessage;
  return useView(defaultValue, (state, setState) => {
    return (
      <FormControlView {...formControlViewProps}>
        <Input
          value={state}
          onChange={(e) => setState(e.target.value)}
          {...inputProps}
          isInvalid={isInvalid}
          focusBorderColor={isInvalid ? "red.500" : undefined}
        />
      </FormControlView>
    );
  });
}

type UseNumberInputViewConfig = UseFormControlConfig<number, NumberInputProps>;

export function useNumberInputView({
  defaultValue,
  inputProps,
  ...formControlViewProps
}: UseNumberInputViewConfig = {}) {
  const [inputView, inputValue] = useView(defaultValue, (state, setState) => (
    <FormControlView {...formControlViewProps}>
      <NumberInput {...inputProps} value={state} onChange={(_, valueNumber) => setState(valueNumber)}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </FormControlView>
  ));

  return [inputView, inputValue] as const;
}
