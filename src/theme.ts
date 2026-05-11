import { extendTheme } from "@chakra-ui/react";

const componentSm = { defaultProps: { size: "sm" } };

export const theme = extendTheme({
  components: {
    Button: componentSm,
    Input: componentSm,
    Select: componentSm,
    NumberInput: componentSm,
    Checkbox: componentSm,
    Radio: componentSm,
    Switch: componentSm,
    Textarea: componentSm,
    Badge: componentSm,
    Tag: componentSm,
  },
});
