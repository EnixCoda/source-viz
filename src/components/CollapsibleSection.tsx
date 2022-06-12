import * as React from "react";

export function CollapsibleSection({
  label, children, ...rest
}: { label: React.ReactNode; children: React.ReactNode; } & React.DetailedHTMLProps<
  React.DetailsHTMLAttributes<HTMLDetailsElement>, HTMLDetailsElement
>) {
  return (
    <details {...rest}>
      <summary>{label}</summary>
      {children}
    </details>
  );
}
