import { Box, BoxProps } from "@chakra-ui/react";

export function VerticalResizeHandler(props: BoxProps) {
  return (
    <Box
      height="4px"
      width="100%"
      flexShrink={0}
      bg="gray.100"
      _hover={{ bg: "blue.200" }}
      _active={{ bg: "blue.300" }}
      cursor="ns-resize"
      {...props}
    />
  );
}
