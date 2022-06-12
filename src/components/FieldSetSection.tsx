import * as React from "react";

export function FieldSetSection({
  label, children, ...rest
}: { label: React.ReactNode; children: React.ReactNode; } & React.HTMLAttributes<HTMLFieldSetElement>) {
  return (
    <fieldset {...rest}>
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}
