import { FormControl, FormLabel, Switch } from "@chakra-ui/react";
import * as React from "react";
import { useView } from "./useView";

export function useSwitchView(label: React.ReactNode, defaultChecked: boolean) {
  return useView(
    defaultChecked,
    (checked, setChecked) => (
      <FormControl>
        <FormControl display="flex" alignItems="center" columnGap={1}>
          <Switch isChecked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <FormLabel mb={0}>{label}</FormLabel>
        </FormControl>
      </FormControl>
    ),
    [label],
  );
}
