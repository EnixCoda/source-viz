import { FormControl, FormControlProps, FormErrorMessage, FormHelperText, FormLabel } from "@chakra-ui/react";
import * as React from "react";
import { Equal, Expect } from "../../check";

type ViewProps<T, InputProps> = {
  defaultValue?: T;
  inputProps?: InputProps;
};

export type UseFormControlConfig<T, InputProps> = ViewProps<T, InputProps> & FormControlViewProps;

// ts check no common keys between `ViewProps` and `FormControlViewProps`
export type __test__ = Expect<Equal<keyof FormControlViewProps & keyof ViewProps<unknown, unknown>, never>>;

export type FormControlViewProps = {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  formControlProps?: Partial<FormControlProps>;
  row?: boolean;
  putLabelBehind?: boolean;
};

export function FormControlView({
  label,
  errorMessage,
  formControlProps,
  helperText,
  row,
  putLabelBehind,
  children,
}: React.PropsWithChildren<FormControlViewProps>) {
  const labelElement = label && <FormLabel marginBottom={row ? 0 : undefined}>{label}</FormLabel>;

  return (
    <FormControl
      {...(row
        ? {
            display: "inline-flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            gap: 2,
          }
        : {})}
      {...formControlProps}
    >
      {!putLabelBehind && labelElement}
      {children}
      {putLabelBehind && labelElement}
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
      {errorMessage && <FormErrorMessage>{errorMessage}</FormErrorMessage>}
    </FormControl>
  );
}
