import { Checkbox, CheckboxProps } from "@chakra-ui/react";
import { FormControlView, UseFormControlConfig } from "./FormControlView";
import { useView } from "./useView";

export function useCheckboxView({
  defaultValue = false,
  inputProps,
  label, // do not merge this with formControlViewProps for checkbox
  ...formControlViewProps
}: UseFormControlConfig<boolean, CheckboxProps> = {}) {
  return useView(defaultValue, (checked, setChecked) => (
    <FormControlView {...formControlViewProps}>
      <Checkbox isChecked={checked} onChange={(e) => setChecked(e.target.checked)} {...inputProps}>
        {label}
      </Checkbox>
    </FormControlView>
  ));
}
