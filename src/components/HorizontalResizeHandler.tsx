import { Box, BoxProps } from "@chakra-ui/react";

export function HorizontalResizeHandler(props: BoxProps) {
  return (
    <Box
      display="inline-block"
      width="2px"
      flexShrink={0}
      background={"ButtonFace"}
      _hover={{
        background: "ButtonHighlight",
        outline: "1px solid ButtonHighlight",
      }}
      _active={{
        background: "ActiveBorder",
        outline: "1px solid ActiveBorder",
      }}
      cursor="ew-resize"
      {...props}
    />
  );
}
