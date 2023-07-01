import { ExternalLinkIcon } from "@chakra-ui/icons";
import { Box, Button, IconButton, Text, Tooltip } from "@chakra-ui/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useInputView } from "../hooks/view/useInputView";
import { ReactState } from "./type";

export const LocalPathContext = createContext<ReactState<string> | undefined>(undefined);

export function LocalPathContextProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <LocalPathContext.Provider value={useMemo(() => ({ value, setValue }), [value, setValue])}>
      {children}
    </LocalPathContext.Provider>
  );
}

export function OpenInVSCodeSettings() {
  const [view, input] = useInputView("", {
    label: "Open file in VSCode",
    inputProps: {
      placeholder: "/local/absolute/path/to/root/dir/",
    },
  });
  const ctx = useContext(LocalPathContext);
  const setValue = ctx?.setValue;
  useEffect(() => {
    setValue?.(input);
  }, [input, setValue]);

  return (
    <Box>
      {view}
      <Text fontSize="sm">Input root folder's path, then you can open files in VS Code.</Text>
    </Box>
  );
}

export function OpenInVSCode({ path, layout = "icon" }: { layout: "icon" | "text"; path?: string | undefined }) {
  const ctx = useContext(LocalPathContext);
  const localPath = ctx?.value;

  switch (layout) {
    case "icon":
      return (
        <Tooltip
          label={
            localPath
              ? "Open file in VSCode"
              : "Open file in VSCode; Please set path of scan root in General Settings to enable this feature."
          }
        >
          <IconButton
            aria-label="Open in VS Code"
            icon={<ExternalLinkIcon />}
            disabled={!localPath}
            onClick={() => {
              if (localPath) window.open(`vscode://file/${(localPath + "/" + path).replace(/\/\/+/g, "/")}`);
            }}
          />
        </Tooltip>
      );
    case "text":
      return (
        <Tooltip
          label={localPath ? undefined : "Please set path of scan root in General Settings to enable this feature."}
        >
          <Button
            disabled={!localPath}
            onClick={() => {
              if (localPath) window.open(`vscode://file/${(localPath + "/" + path).replace(/\/\/+/g, "/")}`);
            }}
          >
            Open in VS Code
          </Button>
        </Tooltip>
      );
  }
}
