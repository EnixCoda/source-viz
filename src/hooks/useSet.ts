import React from "react";

export function useSet<T>(initialValue: T[] = []) {
  const [values, setValues] = React.useState<T[]>(initialValue);
  const toggle = React.useCallback(function toggle(value: T) {
    setValues((values) => (values.includes(value) ? values.filter((n) => n !== value) : values.concat(value)));
  }, []);

  return [values, toggle] as const;
}
