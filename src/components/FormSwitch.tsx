import { Switch, SwitchProps } from "@chakra-ui/react";
import { FormControlView, UseFormControlConfig } from "../hooks/view/FormControlView";
import { ReactStateProps } from "../types";

export function FormSwitch({
  defaultValue = false,
  inputProps,
  value,
  onChange,
  ...formControlViewProps
}: UseFormControlConfig<boolean, SwitchProps> & ReactStateProps<boolean>) {
  return (
    <FormControlView row putLabelBehind {...formControlViewProps}>
      <Switch isChecked={value} onChange={(e) => onChange(e.target.checked)} {...inputProps} />
    </FormControlView>
  );
}
