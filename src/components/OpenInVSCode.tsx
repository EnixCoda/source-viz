import { ExternalLinkIcon } from "@chakra-ui/icons";
import { Box, FormControl, FormErrorMessage, IconButton, InputProps } from "@chakra-ui/react";
import { useInputView } from "../hooks/view/useInputView";

export function OpenInVSCode({
  filePath,
  props = {
    placeholder: "/path/to/repository/",
  },
}: {
  filePath?: string;
  props?: InputProps;
}) {
  const [view, input] = useInputView("", props);

  return (
    <FormControl>
      <Box display="flex" columnGap={1}>
        <IconButton
          aria-label="Open in VS Code"
          icon={<ExternalLinkIcon />}
          disabled={!input}
          onClick={() => {
            if (input) window.open(`vscode://file/${input + filePath}`);
          }}
        />
        {view}
      </Box>
      {!input && <FormErrorMessage>Cannot open in VS Code</FormErrorMessage>}
    </FormControl>
  );
}
