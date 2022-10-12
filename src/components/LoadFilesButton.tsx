import { Button, ButtonProps } from "@chakra-ui/react";
import { useRef } from "react";

export function LoadFilesButton({
  onLoad,
  accept,
  multiple,
  buttonProps,
  children = buttonProps?.children,
}: {
  onLoad: (files: FileList | null) => void;
  buttonProps?: ButtonProps;
  multiple?: boolean;
  children?: ButtonProps["children"];
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, "accept">) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Button
        {...buttonProps}
        onClick={(e) => {
          buttonProps?.onClick?.(e);
          inputRef.current?.click();
        }}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        hidden
        type="file"
        style={{ width: 0, height: 0 }}
        {...{
          webkitdirectory: multiple ? "true" : undefined, // avoid type error
          multiple,
        }}
        accept={accept}
        onChange={(event) => onLoad(event.target.files)}
      />
    </>
  );
}
