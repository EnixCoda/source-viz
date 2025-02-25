import { Button, ButtonProps } from "@chakra-ui/react";
import { FS } from "./App";

export function FSLoadFilesButton({
  onLoad,
  buttonProps,
  children = buttonProps?.children,
}: {
  onLoad: (fs: FS) => void;
  buttonProps?: ButtonProps;
  children?: ButtonProps["children"];
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, "accept">) {
  return (
    <Button
      {...buttonProps}
      onClick={async () => {
        const { showDirectoryPicker } = window;
        const isSupported = !!showDirectoryPicker;
        if (!isSupported) {
          alert("Please use Chrome/Edge");
          return;
        }

        const handle = await showDirectoryPicker();
        if (handle) onLoad({ handle });
      }}
    >
      {children}
    </Button>
  );
}
