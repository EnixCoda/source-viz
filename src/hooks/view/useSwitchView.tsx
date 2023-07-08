import { SwitchProps } from "@chakra-ui/react";
import { FormSwitch } from "../../components/FormSwitch";
import { UseFormControlConfig } from "./FormControlView";
import { useView } from "./useView";

export function useSwitchView({
  defaultValue = false,
  inputProps,
  ...formControlViewProps
}: UseFormControlConfig<boolean, SwitchProps>) {
  return useView(defaultValue, (checked, setChecked) => (
    <FormSwitch inputProps={inputProps} value={checked} onChange={setChecked} {...formControlViewProps} />
  ));
}
