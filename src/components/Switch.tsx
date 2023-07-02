import { Switch as ChakraSwitch, FormControl, FormLabel, SwitchProps } from "@chakra-ui/react";
import { PropsWithChildren } from "react";

export function Switch({ children, ...rest }: PropsWithChildren<SwitchProps>) {
  return (
    <FormControl display="flex" alignItems="center" columnGap={1}>
      <ChakraSwitch {...rest} />
      <FormLabel mb={0}>{children}</FormLabel>
    </FormControl>
  );
}
