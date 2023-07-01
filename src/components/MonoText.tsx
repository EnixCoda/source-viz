import { Text, TextProps } from "@chakra-ui/react";

export function MonoText(props: TextProps) {
  return <Text fontFamily="Cascadia Code, monospace" {...props} />;
}
